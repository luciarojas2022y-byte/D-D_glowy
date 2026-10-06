/* ============================================================
   D&D GLOWY · JavaScript principal
   Funciones: render del catálogo, filtros, búsqueda, carrito,
   envío de pedido por WhatsApp, cuenta regresiva, animaciones.
   ============================================================ */

(function () {
  "use strict";

  /* ---------- Utilidades ---------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  // Formatea un número como precio en soles peruanos
  const soles = (n) =>
    "S/ " + Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Muestra un aviso flotante
  let toastTimer;
  function toast(message, icon = "fa-circle-check") {
    const el = $("#toast");
    if (!el) return;
    el.innerHTML = '<i class="fa-solid ' + icon + '"></i>' + message;
    el.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-show"), 2600);
  }

  /* ============================================================
     1. RENDER DEL CATÁLOGO
     ============================================================ */
  const grid = $("#products-grid");
  const emptyState = $("#empty-state");
  let activeFilter = "todos";
  let searchTerm = "";

  function badgeHTML(badges) {
    return (badges || [])
      .map((b) => '<span class="badge badge--' + b.type + '">' + b.text + "</span>")
      .join("");
  }

  function includesHTML(list) {
    return (list || []).map((i) => "<span>" + i + "</span>").join("");
  }

  function productCard(p) {
    const art = document.createElement("article");
    art.className = "product";
    art.dataset.category = p.category;
    art.innerHTML =
      '<div class="product__media">' +
        '<div class="product__badges">' + badgeHTML(p.badges) + "</div>" +
        '<img src="' + p.image + '" alt="' + p.name + '" loading="lazy" />' +
      "</div>" +
      '<div class="product__body">' +
        '<p class="product__cat">' + p.categoryName + "</p>" +
        "<h3 class=\"product__name\">" + p.name + "</h3>" +
        '<p class="product__desc">' + p.desc + "</p>" +
        '<div class="product__rating">' +
          "★".repeat(Math.round(p.rating)) +
          '<span>(' + p.rating.toFixed(1) + " · " + p.reviews + " opiniones)</span>" +
        "</div>" +
        '<div class="product__includes">' + includesHTML(p.includes) + "</div>" +
        '<div class="product__foot">' +
          '<div class="product__prices">' +
            '<span class="price-old">' + soles(p.priceOld) + "</span>" +
            '<span class="price-now">' + soles(p.price).replace("S/ ", "S/&nbsp;") + "</span>" +
          "</div>" +
          '<button class="product__add" data-add="' + p.id + '" aria-label="Agregar ' + p.name + ' al carrito">' +
            '<i class="fa-solid fa-plus"></i>' +
          "</button>" +
        "</div>" +
      "</div>";
    return art;
  }

  function renderCatalog() {
    if (!grid) return;
    const term = searchTerm.trim().toLowerCase();
    const list = CATALOG.filter((p) => {
      const okCat = activeFilter === "todos" || p.category === activeFilter;
      const okTxt =
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.desc.toLowerCase().includes(term) ||
        p.categoryName.toLowerCase().includes(term) ||
        (p.includes || []).join(" ").toLowerCase().includes(term);
      return okCat && okTxt;
    });

    grid.innerHTML = "";
    list.forEach((p, i) => {
      const card = productCard(p);
      card.style.animationDelay = i * 60 + "ms";
      grid.appendChild(card);
    });

    if (emptyState) emptyState.hidden = list.length !== 0;
  }

  /* ============================================================
     2. FILTROS Y BÚSQUEDA
     ============================================================ */
  function initFilters() {
    $$(".filter").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$(".filter").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        activeFilter = btn.dataset.filter;
        renderCatalog();
      });
    });

    $$(".cat-card").forEach((card) => {
      card.addEventListener("click", () => {
        const f = card.dataset.filter;
        const target = $$(".filter").find((b) => b.dataset.filter === f);
        if (target) target.click();
        $("#packs").scrollIntoView({ behavior: "smooth" });
      });
    });

    const input = $("#search-input");
    if (input) {
      input.addEventListener("input", (e) => {
        searchTerm = e.target.value;
        renderCatalog();
      });
    }
  }

  /* ============================================================
     3. CARRITO
     ============================================================ */
  const STORAGE_KEY = "ddglowy_cart_v1";
  let cart = loadCart();

  function loadCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }
  function saveCart() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch (e) {}
  }
  function findProduct(id) {
    return CATALOG.find((p) => p.id === id);
  }

  function addToCart(id, qty = 1) {
    const p = findProduct(id);
    if (!p) return;
    const item = cart.find((c) => c.id === id);
    if (item) item.qty += qty;
    else cart.push({ id: p.id, name: p.name, price: p.price, image: p.image, qty: qty });
    saveCart();
    updateCartUI();
    bumpCartIcon();
    toast("Agregado: " + p.name, "fa-bag-shopping");
    openCart();
  }

  function changeQty(id, delta) {
    const item = cart.find((c) => c.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) cart = cart.filter((c) => c.id !== id);
    saveCart();
    updateCartUI();
  }

  function removeItem(id) {
    cart = cart.filter((c) => c.id !== id);
    saveCart();
    updateCartUI();
  }

  function clearCart() {
    cart = [];
    saveCart();
    updateCartUI();
    toast("Carrito vaciado", "fa-trash-can");
  }

  function cartTotals() {
    const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
    const units = cart.reduce((s, c) => s + c.qty, 0);
    const shipping = subtotal === 0 ? 0 : subtotal >= 150 ? 0 : 12;
    return { subtotal, units, shipping, total: subtotal + shipping };
  }

  function bumpCartIcon() {
    const badge = $("#cart-count");
    if (!badge) return;
    badge.classList.remove("is-bump");
    void badge.offsetWidth;
    badge.classList.add("is-bump");
  }

  function updateCartUI() {
    const countEl = $("#cart-count");
    const body = $("#cart-items");
    const { subtotal, units, shipping, total } = cartTotals();

    if (countEl) countEl.textContent = units;
    if ($("#cart-subtotal")) $("#cart-subtotal").textContent = soles(subtotal);
    if ($("#cart-shipping")) $("#cart-shipping").textContent = subtotal === 0 ? "Por calcular" : shipping === 0 ? "¡Gratis!" : soles(shipping);
    if ($("#cart-total")) $("#cart-total").textContent = soles(total);

    if (!body) return;
    if (cart.length === 0) {
      body.innerHTML =
        '<div class="cart-empty">' +
          '<i class="fa-solid fa-bag-shopping"></i>' +
          "<p>Tu carrito está vacío.<br />¡Elige tu pack favorito y brilla! ✨</p>" +
        "</div>";
      return;
    }

    body.innerHTML = cart
      .map(
        (c) =>
          '<div class="cart-item">' +
            '<img src="' + c.image + '" alt="' + c.name + '" />' +
            '<div class="cart-item__info">' +
              "<h4>" + c.name + "</h4>" +
              "<p>" + soles(c.price) + "</p>" +
              '<div class="cart-item__qty">' +
                '<button data-minus="' + c.id + '" aria-label="Quitar una unidad"><i class="fa-solid fa-minus"></i></button>' +
                "<span>" + c.qty + "</span>" +
                '<button data-plus="' + c.id + '" aria-label="Agregar una unidad"><i class="fa-solid fa-plus"></i></button>' +
              "</div>" +
            "</div>" +
            '<button class="cart-item__remove" data-remove="' + c.id + '" aria-label="Eliminar del carrito"><i class="fa-solid fa-xmark"></i></button>' +
          "</div>"
      )
      .join("");
  }

  /* ---------- Abrir / cerrar carrito ---------- */
  function openCart() {
    const cartEl = $("#cart");
    const overlay = $("#cart-overlay");
    if (!cartEl) return;
    cartEl.classList.add("is-open");
    cartEl.setAttribute("aria-hidden", "false");
    if (overlay) overlay.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeCart() {
    const cartEl = $("#cart");
    const overlay = $("#cart-overlay");
    if (!cartEl) return;
    cartEl.classList.remove("is-open");
    cartEl.setAttribute("aria-hidden", "true");
    if (overlay) overlay.hidden = true;
    document.body.style.overflow = "";
  }

  /* ============================================================
     4. PEDIDO POR WHATSAPP
     ============================================================ */
  function buildWhatsAppMessage() {
    const { subtotal, shipping, total } = cartTotals();
    const name = ($("#customer-name") && $("#customer-name").value.trim()) || "";
    const place = ($("#customer-place") && $("#customer-place").value.trim()) || "";

    let msg = "¡Hola D&D Glowy! ✨ Quiero hacer este pedido:\n\n";
    cart.forEach((c, i) => {
      msg += (i + 1) + ". " + c.name + " x" + c.qty + " — " + soles(c.price * c.qty) + "\n";
    });
    msg += "\nSubtotal: " + soles(subtotal);
    msg += "\nEnvío: " + (shipping === 0 ? "Gratis / por confirmar" : soles(shipping));
    msg += "\n*TOTAL: " + soles(total) + "*";
    if (name) msg += "\n\nNombre: " + name;
    if (place) msg += "\nEntrega en: " + place;
    msg += "\n\nQuedo atenta a la confirmación. ¡Gracias!";
    return msg;
  }

  function sendOrder() {
    if (cart.length === 0) {
      toast("Tu carrito está vacío. Agrega un pack primero 😊", "fa-triangle-exclamation");
      return;
    }
    const msg = buildWhatsAppMessage();
    const url = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(msg);

    // Guardamos el pedido (queda registrado para la tienda)
    saveOrderToStore();

    window.open(url, "_blank", "noopener");
    toast("Abriendo WhatsApp con tu pedido 🎉", "fa-brands fa-whatsapp");
  }

  /* ---------- Registro del pedido en la API de tablas ----------
     Se guarda de forma silenciosa: si la API no está disponible
     (por ejemplo al abrir el archivo localmente en Visual Studio),
     el pedido igualmente se envía por WhatsApp sin mostrar errores. */
  function saveOrderToStore() {
    const { subtotal, shipping, total } = cartTotals();
    const payload = {
      customer_name: ($("#customer-name") && $("#customer-name").value.trim()) || "Cliente web",
      customer_place: ($("#customer-place") && $("#customer-place").value.trim()) || "No indicado",
      phone: WHATSAPP_NUMBER,
      items: cart.map((c) => c.name + " x" + c.qty).join(" | "),
      units: cart.reduce((s, c) => s + c.qty, 0),
      subtotal: subtotal,
      shipping: shipping,
      total: total,
      status: "nuevo"
    };
    try {
      fetch("tables/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } catch (e) {
      /* Silencioso: el pedido igual se envía por WhatsApp */
    }
  }

  /* ============================================================
     5. CUENTA REGRESIVA DE LA PROMO
     ============================================================ */
  function initTimer() {
    const endsAt = (() => {
      const stored = Number(localStorage.getItem("ddglowy_promo_end"));
      if (stored && stored > Date.now()) return stored;
      const next = Date.now() + 1000 * 60 * 60 * 48; // 48 horas
      try { localStorage.setItem("ddglowy_promo_end", String(next)); } catch (e) {}
      return next;
    })();

    const pad = (n) => String(n).padStart(2, "0");
    const tick = () => {
      const diff = Math.max(0, endsAt - Date.now());
      const s = Math.floor(diff / 1000);
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      if ($("#t-days")) $("#t-days").textContent = pad(d);
      if ($("#t-hours")) $("#t-hours").textContent = pad(h);
      if ($("#t-mins")) $("#t-mins").textContent = pad(m);
      if ($("#t-secs")) $("#t-secs").textContent = pad(sec);
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ============================================================
     6. MENÚ MÓVIL, CABECERA Y NAVEGACIÓN
     ============================================================ */
  function initUI() {
    const burger = $("#burger");
    const nav = $("#nav");
    if (burger && nav) {
      burger.addEventListener("click", () => {
        const open = nav.classList.toggle("is-open");
        burger.classList.toggle("is-open", open);
        burger.setAttribute("aria-expanded", String(open));
      });
      $$(".nav__link").forEach((a) =>
        a.addEventListener("click", () => {
          nav.classList.remove("is-open");
          burger.classList.remove("is-open");
          burger.setAttribute("aria-expanded", "false");
        })
      );
    }

    // Sombra de la cabecera al hacer scroll + botón "volver arriba"
    const header = $("#header");
    const toTop = $("#to-top");
    const onScroll = () => {
      const y = window.scrollY;
      if (header) header.classList.toggle("is-stuck", y > 20);
      if (toTop) toTop.classList.toggle("is-show", y > 500);

      // Resaltar el enlace de la sección visible
      const links = $$(".nav__link");
      let current = "";
      $$("main section[id]").forEach((sec) => {
        if (window.scrollY >= sec.offsetTop - 140) current = sec.id;
      });
      links.forEach((l) => l.classList.toggle("is-active", l.getAttribute("href") === "#" + current));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    if (toTop) toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  /* ============================================================
     7. EVENTOS GLOBALES
     ============================================================ */
  function initEvents() {
    // Delegación de clics para botones dinámicos
    document.addEventListener("click", (e) => {
      const add = e.target.closest("[data-add]");
      if (add) { addToCart(add.dataset.add, 1); return; }

      const plus = e.target.closest("[data-plus]");
      if (plus) { changeQty(plus.dataset.plus, 1); return; }

      const minus = e.target.closest("[data-minus]");
      if (minus) { changeQty(minus.dataset.minus, -1); return; }

      const remove = e.target.closest("[data-remove]");
      if (remove) { removeItem(remove.dataset.remove); return; }
    });

    if ($("#cart-open")) $("#cart-open").addEventListener("click", openCart);
    if ($("#cart-close")) $("#cart-close").addEventListener("click", closeCart);
    if ($("#cart-overlay")) $("#cart-overlay").addEventListener("click", closeCart);
    if ($("#clear-cart")) $("#clear-cart").addEventListener("click", clearCart);
    if ($("#send-order")) $("#send-order").addEventListener("click", sendOrder);
    if ($("#add-combo")) $("#add-combo").addEventListener("click", () => addToCart(COMBO.id, 1));

    // Cerrar el carrito con la tecla Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeCart();
    });
  }

  /* ============================================================
     8. INICIO
     ============================================================ */
  document.addEventListener("DOMContentLoaded", () => {
    if ($("#year")) $("#year").textContent = new Date().getFullYear();
    renderCatalog();
    initFilters();
    initUI();
    initEvents();
    initTimer();
    updateCartUI();

    // Animaciones al hacer scroll
    if (window.AOS) {
      window.AOS.init({ duration: 700, once: true, offset: 60, easing: "ease-out-cubic" });
    }
  });
})();
