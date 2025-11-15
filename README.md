# GenericElementFilter

A small, framework-agnostic helper to filter any kind of elements (cards, table rows, list items, …) based on form controls (`<select>`, radios, etc.) and matching `data-*` attributes.

* Multiple filters work together (AND logic)
* Works with any HTML structure (not table-specific)
* Optional View Transitions support
* A11y-friendly (live status and “no results” messaging)
* Can be configured via JS **or** via `data-*` + `bindAll()`

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
  new GenericElementFilter(".mushroom-guide .card", {
    root: document.querySelector(".mushroom-guide"),
    filtersSelector: ".mushroom-filters [name]",
    statusSelector: ".filter-status",
    noResultsSelector: ".no-results-message",
    allValue: "all",
    statusFormatter: (count) =>
      count === 1 ? "1 mushroom visible" : `${count} mushrooms visible`,
  });
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

// later: load more items
function loadMore() {
  const container = document.querySelector(".mushroom-guide .card-list");
  container.insertAdjacentHTML(
    "beforeend",
    `
      <article class="card" data-season="autumn" data-edible="yes">New item</article>
    `
  );

  filter.refreshElements();
}
```

---

## 6. Options overview

```ts
new GenericElementFilter(elementsSelector: string, options?: {
  root?: Element | Document;                 // default: inferred from elementsSelector
  filtersSelector?: string;                  // default: "select[name]"
  noResultsSelector?: string;                // default: ".no-results-message"
  statusSelector?: string;                   // optional
  allValue?: string;                         // default: "all"
  viewTransitionPrefix?: string;             // default: derived from elementsSelector
  statusFormatter?: (count: number) => string;
});
```

* `elementsSelector` **(required)** – selector for elements to filter (cards, rows, etc.)
* `root` – query scope & logical “area” of the filter; if omitted, it’s auto-inferred.
* `filtersSelector` – which controls act as filters (usually something like `.filters [name]`).
* `noResultsSelector` – element shown when no matches are visible; is treated as a polite live region.
* `statusSelector` – optional status line (e.g. “7 results”) – also a live region and linked via `aria-describedby`.
* `allValue` – value used for “show all” options; comparisons are skipped for that filter.
