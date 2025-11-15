# GenericElementFilter

A small, framework-agnostic helper to filter any kind of elements (cards, table rows, list items, …) based on form controls (`<select>`, radios, etc.) and matching `data-*` attributes.

* Multiple filters work together (AND logic)
* Works with any HTML structure (not table-specific)
* Optional View Transitions support
* A11y-friendly (live status and “no results” messaging)
* Configurable via JS **or** via `data-*` + `bindAll()`
* Optional **`matchMode: "contains"`**, **`reset()` helper** and **hooks**

---

## 1. Basic concept

Each filter control needs a `name`.
Each filterable element needs matching `data-*` attributes.

```html
<select name="season">
  <option value="all">All</option>
  <option value="spring">Spring</option>
  <option value="summer">Summer</option>
</select>

<article class="card" data-season="spring">…</article>
<article class="card" data-season="summer">…</article>
```

* `name="season"` → `data-season="…"`
* `allValue` (default `"all"`) means “don’t filter on this field”.

---

## 2. Usage A – Manual init with explicit `root` (recommended)

```html
<section class="mushroom-guide">
  <div class="mushroom-filters">
    <select name="season">
      <option value="all">All seasons</option>
      <option value="spring">Spring</option>
      <option value="summer">Summer</option>
    </select>

    <select name="edible">
      <option value="all">All</option>
      <option value="yes">Edible</option>
      <option value="no">Not edible</option>
    </select>
  </div>

  <p class="filter-status"></p>
  <p class="no-results-message" hidden>No matches found.</p>

  <div class="card-list">
    <article class="card" data-season="spring" data-edible="yes">…</article>
    <article class="card" data-season="summer" data-edible="no">…</article>
  </div>
</section>
```

```js
document.addEventListener("DOMContentLoaded", () => {
  const filter = new GenericElementFilter(".mushroom-guide .card", {
    root: document.querySelector(".mushroom-guide"),
    filtersSelector: ".mushroom-filters [name]",
    statusSelector: ".filter-status",
    noResultsSelector: ".no-results-message",
    allValue: "all",
    statusFormatter: (count) =>
      count === 1 ? "1 mushroom visible" : `${count} mushrooms visible`,
  });

  // Optional: wire a reset button
  document
    .querySelector(".filter-reset")
    ?.addEventListener("click", () => filter.reset());
});
```

---

## 3. Usage B – Manual init *without* `root` (auto-inferred root)

If you don’t pass a `root`, the filter will infer one from the first matching element:

* Prefer `[data-filter-root], section, article, main`
* Fallback to the element’s parent
* Final fallback: `document`

```html
<div class="product-filters">
  <select name="category">
    <option value="all">All</option>
    <option value="tools">Tools</option>
    <option value="books">Books</option>
  </select>
</div>

<div class="product-list">
  <article class="product-card" data-category="tools">…</article>
  <article class="product-card" data-category="books">…</article>
</div>
```

```js
document.addEventListener("DOMContentLoaded", () => {
  new GenericElementFilter(".product-card", {
    filtersSelector: ".product-filters [name]",
    // root is inferred automatically
  });
});
```

---

## 4. Usage C – Auto binding via `bindAll()` + `data-*`

For template/CMS setups: configure via `data-*` on a filter container and call `bindAll()`.

```html
<section class="city-section">
  <div
    class="city-filters"
    data-filter-elements=".city-list .city-card"
    data-filter-status=".city-filter-status"
    data-filter-no-results=".city-no-results"
    data-filter-all-value="all"
  >
    <select name="country">
      <option value="all">All countries</option>
      <option value="de">Germany</option>
      <option value="at">Austria</option>
    </select>

    <select name="size">
      <option value="all">All sizes</option>
      <option value="small">Small</option>
      <option value="big">Big</option>
    </select>
  </div>

  <p class="city-filter-status"></p>
  <p class="city-no-results" hidden>No cities match your selection.</p>

  <div class="city-list">
    <article class="city-card" data-country="de" data-size="big">Berlin</article>
    <article class="city-card" data-country="at" data-size="small">Graz</article>
  </div>
</section>
```

```js
document.addEventListener("DOMContentLoaded", () => {
  GenericElementFilter.bindAll();
});
```

`bindAll(root = document)`:

* finds all containers with `data-filter-elements`
* reads from `dataset`:

  * `data-filter-elements` → `elementsSelector`
  * `data-filter-status` → `statusSelector`
  * `data-filter-no-results` → `noResultsSelector` (default: `.no-results-message`)
  * `data-filter-all-value` → `allValue` (default: `"all"`)
* creates one `GenericElementFilter` per container

> ⚠️ Don’t also manually call `new GenericElementFilter(...)` for the same container, or you’ll get two instances.
> If you mix styles, either:
>
> * call `bindAll` only on a specific root (e.g. `bindAll(widgetRoot)`), or
> * set `container.__genericElementFilter = instance` on your manually initialised container so `bindAll` skips it.

---

## 5. Dynamic content (`refreshElements()`)

After adding or removing elements that should be filtered, call `refreshElements()`:

```js
const filter = new GenericElementFilter(".mushroom-guide .card", {
  root: document.querySelector(".mushroom-guide"),
  filtersSelector: ".mushroom-filters [name]",
});

async function loadMore() {
  const container = document.querySelector(".mushroom-guide .card-list");

  container.insertAdjacentHTML(
    "beforeend",
    `
      <article class="card" data-season="autumn" data-edible="yes">
        New item
      </article>
    `
  );

  filter.refreshElements();
}
```

---

## 6. Multi-value / `matchMode: "contains"`

You can switch the matching logic from strict equality to a simple **token-based `contains` mode**.

* In `"equals"` mode (default):
  `data-tags="forest meadow"` only matches `value="forest"` if the entire string equals `"forest"`.
* In `"contains"` mode:
  `data-tags="forest meadow"` matches if one of the tokens equals the filter value.

Tokens are derived from:

* comma-separated: `data-tags="forest, meadow"`, or
* whitespace-separated: `data-tags="forest meadow"`

### Example

```html
<select name="tag">
  <option value="all">All tags</option>
  <option value="forest">Forest</option>
  <option value="meadow">Meadow</option>
</select>

<article class="card" data-tag="forest meadow">…</article>
<article class="card" data-tag="meadow">…</article>
<article class="card" data-tag="water">…</article>
```

```js
document.addEventListener("DOMContentLoaded", () => {
  new GenericElementFilter(".card", {
    root: document.querySelector(".tag-filter"),
    filtersSelector: "select[name]",
    allValue: "all",
    matchMode: "contains", // <- enables token-based matching on data-*
  });
});
```

In this setup:

* selecting `"forest"` shows all elements whose `data-tag` contains the token `forest`
* selecting `"all"` shows everything.

---

## 7. Reset helper (`reset()`)

`reset()`:

* resets all filter controls to `allValue` if possible (or to their first option),
* updates `currentFilters`,
* and re-applies filtering.

Typical wiring:

```html
<button type="button" class="filters-reset">Reset filters</button>
```

```js
document.addEventListener("DOMContentLoaded", () => {
  const filter = new GenericElementFilter(".mushroom-guide .card", {
    root: document.querySelector(".mushroom-guide"),
    filtersSelector: ".mushroom-filters [name]",
    allValue: "all",
  });

  document
    .querySelector(".filters-reset")
    ?.addEventListener("click", () => filter.reset());
});
```

Basic handling:

* For `<select>` elements:

  * prefer an option with `value === allValue` (if present),
  * otherwise select the first option.
* For inputs:

  * checkboxes/radios → unchecked, logical filter value set to `allValue`.
  * text inputs → cleared, logical filter value set to `allValue`.

---

## 8. Hooks (`onBeforeFilter`, `onAfterFilter`)

You can plug into the filtering lifecycle:

```js
new GenericElementFilter(".mushroom-guide .card", {
  root: document.querySelector(".mushroom-guide"),
  filtersSelector: ".mushroom-filters [name]",
  onBeforeFilter: ({ currentFilters, elements }) => {
    console.debug("About to filter with:", currentFilters, elements.length);
  },
  onAfterFilter: ({ currentFilters, visibleCount, totalCount, elements }) => {
    console.debug(
      "Filter result:",
      currentFilters,
      `visible: ${visibleCount}/${totalCount}`
    );
  },
});
```

Both hooks receive **copies** of the current state and the elements array, so you don’t accidentally mutate internal state.

* `onBeforeFilter({ currentFilters, elements })`
* `onAfterFilter({ currentFilters, visibleCount, totalCount, elements })`

Typical use-cases:

* Logging / debugging
* Analytics
* Custom UI updates outside the basic “status + no results” messaging

---

## 9. Options overview

```ts
new GenericElementFilter(elementsSelector: string, options?: {
  root?: Element | Document;                 // default: inferred from elementsSelector
  filtersSelector?: string;                  // default: "select[name]"
  noResultsSelector?: string;                // default: ".no-results-message"
  statusSelector?: string;                   // optional
  allValue?: string;                         // default: "all"
  viewTransitionPrefix?: string;             // default: derived from elementsSelector
  statusFormatter?: (count: number) => string;
  matchMode?: "equals" | "contains";         // default: "equals"
  onBeforeFilter?: (ctx: {
    currentFilters: Record<string, string>;
    elements: Element[];
  }) => void;
  onAfterFilter?: (ctx: {
    currentFilters: Record<string, string>;
    visibleCount: number;
    totalCount: number;
    elements: Element[];
  }) => void;
});
```
