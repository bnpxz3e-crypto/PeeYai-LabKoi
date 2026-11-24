/* CUSTOMER ONLY — group menu cards by category without modifying ordering or checkout. */
(() => {
  'use strict';
  const preferred = ['เมนูเนื้อ', 'เมนูหมู', 'ส้มตำ', 'จานเดียว', 'เพิ่มเติม', 'เครื่องดื่ม'];

  function groupCustomerFoods() {
    const container = document.getElementById('foods');
    if (!container) return;
    const cards = [...container.children].filter(el => el.classList.contains('food-card'));
    if (!cards.length) return; // Preserve empty-menu message from the existing application.

    const categories = new Map();
    cards.forEach(card => {
      const category = (card.querySelector('.food-category')?.textContent || 'เมนูอื่น ๆ').trim();
      if (!categories.has(category)) categories.set(category, []);
      categories.get(category).push(card);
    });
    const sorted = [...categories.keys()].sort((a, b) => {
      const ia = preferred.indexOf(a), ib = preferred.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
    const content = document.createDocumentFragment();
    sorted.forEach((category, index) => {
      const section = document.createElement('section');
      section.className = 'customer-menu-category';
      section.setAttribute('aria-label', category);
      const header = document.createElement('div');
      header.className = 'customer-menu-category-header';
      const heading = document.createElement('h3');
      heading.className = 'customer-menu-category-title';
      heading.textContent = category;
      const count = document.createElement('span');
      count.className = 'customer-menu-category-count';
      count.textContent = `${categories.get(category).length} เมนู`;
      header.append(heading, count);
      const grid = document.createElement('div');
      grid.className = 'customer-menu-category-grid';
      categories.get(category).forEach(card => grid.appendChild(card));
      section.append(header, grid);
      content.appendChild(section);
    });
    container.replaceChildren(content);
    container.classList.add('customer-menu-grouped');
  }

  // The existing application calls render() on initial load and filter changes.
  // Preserve its data flow, cart logic and click actions; only reorganize rendered cards.
  if (typeof render === 'function') {
    const renderOriginal = render;
    render = function(...args) {
      const result = renderOriginal.apply(this, args);
      groupCustomerFoods();
      return result;
    };
  }
  // Handle the unlikely case that initial rendering already completed.
  groupCustomerFoods();
})();
