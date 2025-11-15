// main.js

class GenericElementFilter {
  /**
   * GenericElementFilter
   *
   * Filters a collection of elements (cards, table rows, etc.) based on
   * form controls (e.g. <select>, <input type="radio">). Each control must
   * have a "name" attribute and the elements must have matching data-* attributes
   * (e.g. name="season" <-> data-season="spring").
   *
   * Can be used directly via `new GenericElementFilter(...)`
   * or indirectly via `GenericElementFilter.bindAll()` with
   * data-* configuration on a container element.
   *
   * @param {string} elementsSelector - CSS selector for elements to filter (required)
   * @param {object} options - Configuration options (all optional)
   *   @param {Element|Document} [options.root] - Root element to scope all queries.
   *        If omitted, a root is inferred from elementsSelector.
   *   @param {string} [options.filtersSelector="select[name]"] - Selector for filter controls
   *   @param {string} [options.noResultsSelector=".no-results-message"] - Selector for "no results" message
   *   @param {string} [options.statusSelector] - Selector for an optional live status element
   *   @param {string} [options.allValue="all"] - Value that indicates "no filter" / "show all"
   *   @param {string} [options.viewTransitionPrefix] - Optional prefix for view transition names
   *   @param {function} [options.statusFormatter] - (count) => string for status text
   *   @param {"equals"|"contains"} [options.matchMode="equals"] - How to compare values
   *   @param {function} [options.onBeforeFilter] - Hook called before filtering
   *   @param {function} [options.onAfterFilter] - Hook called after filtering
   */
  constructor(elementsSelector, options = {}) {
    if (!elementsSelector) {
      throw new Error(
        "GenericElementFilter: elementsSelector is required as first argument."
      );
    }

    const {
      root,
      filtersSelector = "select[name]",
      noResultsSelector = ".no-results-message",
      statusSelector,
      allValue = "all",
      viewTransitionPrefix,
      statusFormatter,
      matchMode = "equals",
      onBeforeFilter,
      onAfterFilter,
    } = options;

    // Remember the original selector so we can refresh dynamically later
    this.elementsSelector = elementsSelector;

    // Inject minimal base CSS for [hidden] once per page
    GenericElementFilter._ensureBaseStyles();

    // Root: either explicitly provided or inferred from the elementsSelector
    this.root = root || GenericElementFilter._inferRoot(elementsSelector);

    // Store configuration
    this.filtersSelector = filtersSelector;
    this.noResultsSelector = noResultsSelector;
    this.statusSelector = statusSelector || null;
    this.allValue = allValue;

    // If no explicit viewTransitionPrefix is provided, derive it from the selector
    this.viewTransitionPrefix =
      viewTransitionPrefix ||
      GenericElementFilter._deriveViewTransitionPrefix(elementsSelector);

    // Default status formatter (can be overridden)
    this.statusFormatter =
      typeof statusFormatter === "function"
        ? statusFormatter
        : (count) => `${count} results found`;

    // Match mode: "equals" (default) or "contains"
    this.matchMode = matchMode === "contains" ? "contains" : "equals";

    // Optional hooks
    this.onBeforeFilter =
      typeof onBeforeFilter === "function" ? onBeforeFilter : null;
    this.onAfterFilter =
      typeof onAfterFilter === "function" ? onAfterFilter : null;

    // Holds the currently active filter values, keyed by filter name
    // Example: { season: "all", edible: "all" }
    this.currentFilters = {};

    // Initialization steps split into helpers for readability
    this._initializeElements(this.elementsSelector);
    this._initializeFilters();
    this._initializeAria();

    // Make sure filters are visible and apply initial filtering once
    this.enableFiltering();
    this.filterElements();
  }

  // --------------------------------
  // Elements & status
  // --------------------------------

  /**
   * Initialize the elements to be filtered, their viewTransitionName,
   * and references to auxiliary UI elements (no-results, status).
   *
   * Can be called again (via refreshElements) when new elements are added.
   */
  _initializeElements(elementsSelector) {
    // Elements that will be shown/hidden when filtering
    this.elements = Array.from(
      this.root.querySelectorAll(elementsSelector)
    );

    // Set a viewTransitionName per element to allow smooth transitions
    this.elements.forEach((element, index) => {
      const elementId = element.id || `item-${index + 1}`;
      element.style.viewTransitionName =
        `${this.viewTransitionPrefix}-${elementId}`;
    });

    // Optional "no results" message element
    this.noResultsMessage = this.root.querySelector(this.noResultsSelector);

    // Optional status element that shows a count like "7 results found"
    this.statusElement = this.statusSelector
      ? this.root.querySelector(this.statusSelector)
      : null;
  }

  // --------------------------------
  // Filter controls
  // --------------------------------

  /**
   * Initialize filter controls: read their initial values and
   * attach change listeners that trigger re-filtering.
   */
  _initializeFilters() {
    this.filters = Array.from(
      this.root.querySelectorAll(this.filtersSelector)
    );

    this.filters.forEach((filter) => {
      const filterName = filter.name;

      // Initial value:
      // Use the current form control value as-is if present;
      // fallback to allValue only if it's null/undefined.
      //
      // This keeps behavior identical to an initial state like
      // { season: "all", edible: "all" } as long as the HTML
      // uses value="all" as default (or allValue accordingly).
      this.currentFilters[filterName] =
        filter.value ?? this.allValue;

      filter.addEventListener("change", (event) => this.updateFilter(event));
    });
  }

  // --------------------------------
  // ARIA setup
  // --------------------------------

  /**
   * Initialize ARIA attributes on dynamic status elements.
   * Keeps ARIA usage minimal and focused.
   *
   * - noResultsMessage and statusElement are Live-Regions (role="status", aria-live="polite")
   * - statusElement is referenced via aria-describedby from filter controls (if present)
   */
  _initializeAria() {
    // "No results" message as a polite live region
    if (this.noResultsMessage) {
      if (!this.noResultsMessage.hasAttribute("role")) {
        this.noResultsMessage.setAttribute("role", "status");
      }
      if (!this.noResultsMessage.hasAttribute("aria-live")) {
        this.noResultsMessage.setAttribute("aria-live", "polite");
      }
    }

    // Optional status line (e.g. "7 results found") as live region
    if (this.statusElement) {
      if (!this.statusElement.hasAttribute("role")) {
        this.statusElement.setAttribute("role", "status");
      }
      if (!this.statusElement.hasAttribute("aria-live")) {
        this.statusElement.setAttribute("aria-live", "polite");
      }
    }

    // Link filters to status element via aria-describedby, if available
    if (this.filters && this.filters.length > 0 && this.statusElement) {
      // Ensure status element has an ID
      if (!this.statusElement.id) {
        this.statusElement.id =
          `gef-status-${Math.random().toString(36).slice(2, 8)}`;
      }
      const statusId = this.statusElement.id;

      this.filters.forEach((filter) => {
        const existing = (filter.getAttribute("aria-describedby") || "")
          .trim()
          .split(/\s+/)
          .filter(Boolean);

        if (!existing.includes(statusId)) {
          existing.push(statusId);
          filter.setAttribute("aria-describedby", existing.join(" "));
        }
      });
    }
  }

  // --------------------------------
  // Public methods
  // --------------------------------

  /**
   * Handle filter changes from form controls.
   * Updates the current filter state and triggers filtering with
   * optional View Transitions.
   */
  updateFilter(e) {
    const filterType = e.target.name;
    this.currentFilters[filterType] = e.target.value;

    const runFilter = () => this.filterElements();

    // If View Transitions API is not available, just run the filter
    if (!document.startViewTransition) {
      runFilter();
      return;
    }

    // Use View Transitions API to animate state changes smoothly
    document.startViewTransition(runFilter);
  }

  /**
   * Core filtering logic.
   * Shows/hides elements based on currentFilters and updates
   * "no results" and optional status text.
   *
   * Supports:
   *  - matchMode: "equals" (default) or "contains"
   *    - "contains" splits data-* value on comma or whitespace and checks tokens.
   *  - optional hooks: onBeforeFilter, onAfterFilter
   */
  filterElements() {
    let hasVisibleElements = false;
    let visibleCount = 0;
    const totalCount = this.elements.length;

    // Hook: before filtering
    if (this.onBeforeFilter) {
      this.onBeforeFilter({
        currentFilters: { ...this.currentFilters },
        elements: this.elements.slice(),
      });
    }

    this.elements.forEach((element) => {
      const matchesAllFilters = Object.entries(this.currentFilters).every(
        ([filterName, filterValue]) => {
          // If filter is set to "all" (or configured allValue):
          // do not restrict by this filter type.
          if (filterValue === this.allValue) return true;

          // Read matching data-* attribute from the element, e.g.
          // data-season, data-edible, data-color, ...
          const elementValue = element.dataset[filterName];

          // If the element does not declare this data-* attribute,
          // we ignore this filter for this element.
          if (typeof elementValue === "undefined") return true;

          if (this.matchMode === "contains") {
            const hayRaw = elementValue.trim();
            if (!hayRaw) return false;

            // Support comma- or whitespace-separated tokens
            const parts =
              hayRaw.indexOf(",") !== -1
                ? hayRaw.split(",")
                : hayRaw.split(/\s+/);

            return parts
              .map((p) => p.trim())
              .filter(Boolean)
              .some((p) => p === filterValue);
          }

          // Default: strict equality
          return elementValue === filterValue;
        }
      );

      if (matchesAllFilters) {
        element.hidden = false;
        hasVisibleElements = true;
        visibleCount += 1;
      } else {
        element.hidden = true;
      }
    });

    // Show/hide the "no results" message
    if (this.noResultsMessage) {
      this.noResultsMessage.hidden = hasVisibleElements;
    }

    // Update the optional status line with the number of visible elements
    if (this.statusElement) {
      this.statusElement.textContent = this.statusFormatter(visibleCount);
    }

    // Hook: after filtering
    if (this.onAfterFilter) {
      this.onAfterFilter({
        currentFilters: { ...this.currentFilters },
        visibleCount,
        totalCount,
        elements: this.elements.slice(),
      });
    }
  }

  /**
   * Ensures filter controls are visible.
   * Useful if they are initially hidden until JS is ready.
   */
  enableFiltering() {
    this.filters.forEach((filter) => {
      filter.hidden = false;
    });
  }

  /**
   * Refresh the internal element list when the DOM has changed.
   * Call this after dynamically adding/removing elements that should
   * be included in the filtering logic.
   *
   * Example:
   *   // After appending new cards to the DOM:
   *   cardFilter.refreshElements();
   */
  refreshElements() {
    this._initializeElements(this.elementsSelector);
    this.filterElements();
  }

  /**
   * Reset helper:
   * - Resets all controls to "allValue" if possible, or to their first option.
   * - Updates currentFilters accordingly.
   * - Re-applies filtering.
   */
  reset() {
    if (!this.filters || this.filters.length === 0) return;

    this.filters.forEach((filter) => {
      const name = filter.name;
      if (!name) return;

      if (filter instanceof HTMLSelectElement) {
        const options = Array.from(filter.options || []);
        const hasAllOption = options.some(
          (opt) => opt.value === this.allValue
        );

        if (hasAllOption) {
          filter.value = this.allValue;
        } else if (options.length > 0) {
          filter.selectedIndex = 0;
        }

        this.currentFilters[name] = filter.value ?? this.allValue;
      } else if (filter instanceof HTMLInputElement) {
        // Basic support for text inputs or checkboxes/radios:
        if (filter.type === "checkbox" || filter.type === "radio") {
          // Clear selection; treat "no selection" as "all" logically.
          filter.checked = false;
          this.currentFilters[name] = this.allValue;
        } else {
          filter.value = "";
          this.currentFilters[name] = this.allValue;
        }
      } else {
        // Fallback: just restore to allValue for this filter key
        this.currentFilters[name] = this.allValue;
      }
    });

    this.filterElements();
  }

  // --------------------------------
  // Static helper methods
  // --------------------------------

  /**
   * Derive a viewTransition prefix from the elements selector.
   * Example: ".mushroom-guide .card" -> "card"
   */
  static _deriveViewTransitionPrefix(selector) {
    if (!selector || typeof selector !== "string") return "filter-item";

    const trimmed = selector.trim();
    if (!trimmed) return "filter-item";

    // Take the last part of the selector, e.g. ".mushroom-guide .card" -> ".card"
    const lastPart = trimmed.split(/\s+/).pop() || "";
    // Strip pseudo-classes and attributes, e.g. ".card:hover" -> ".card"
    const withoutPseudo = lastPart.split(/[:\[]/)[0];
    // Remove leading "." or "#"
    const name = withoutPseudo.replace(/^[.#]+/, "");

    return name || "filter-item";
  }

  /**
   * Infer a reasonable root element from the elementsSelector.
   * Used only when no explicit root is provided.
   */
  static _inferRoot(elementsSelector) {
    if (!elementsSelector || typeof elementsSelector !== "string") {
      return document;
    }

    const elements = document.querySelectorAll(elementsSelector);
    const first = elements[0];
    if (!first) return document;

    // Prefer a semantic or explicit container if available
    const container =
      first.closest("[data-filter-root], section, article, main") ||
      first.parentElement ||
      document;

    return container;
  }

  /**
   * Inject minimal base CSS for [hidden] only once per page.
   * Ensures that hidden elements are actually not displayed.
   */
  static _ensureBaseStyles() {
    if (this._baseStylesInjected) return;

    const style = document.createElement("style");
    style.textContent = `
      [hidden] {
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    this._baseStylesInjected = true;
  }

  /**
   * Convenience helper:
   * Automatically binds all filter containers that declare
   * configuration via data-attributes.
   *
   * Expected HTML on a container (for example a <div class="filters">):
   *
   *   <div
   *     class="filters"
   *     data-filter-elements=".product-card"
   *     data-filter-status=".filter-status"
   *     data-filter-no-results=".no-results-message"
   *     data-filter-all-value="all"
   *   >
   *     <!-- controls with name=... inside -->
   *   </div>
   *
   * Usage:
   *   document.addEventListener("DOMContentLoaded", () => {
   *     GenericElementFilter.bindAll();
   *   });
   */
  static bindAll(root = document) {
    const containers = root.querySelectorAll("[data-filter-elements]");

    containers.forEach((container) => {
      // avoid double-binding
      if (container.__genericElementFilter) return;

      const ds = container.dataset;
      const elementsSelector = ds.filterElements;
      if (!elementsSelector) return;

      const statusSelector = ds.filterStatus || null;
      const noResultsSelector = ds.filterNoResults || ".no-results-message";
      const allValue = ds.filterAllValue || "all";

      container.__genericElementFilter = new GenericElementFilter(
        elementsSelector,
        {
          // Scope root to a nearby structural container if possible
          root: container.closest("section, main, body") || root,
          // By default: all controls with a name inside this container
          filtersSelector: "[name]",
          statusSelector,
          noResultsSelector,
          allValue,
        }
      );
    });
  }
}
