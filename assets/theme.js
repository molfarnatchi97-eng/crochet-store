/**
 * Premium Self-Improvement Theme JS
 * Handles Build-a-Bundle selection, AJAX Cart integration, and UI Micro-interactions.
 */

document.addEventListener('DOMContentLoaded', () => {
  initBuildABundle();
  initProductForm();
  initProductTabs();
  initThumbnailGallery();
  initHeaderScroll();
});

/* ==========================================================================
   Build-a-Bundle Functionality
   ========================================================================== */
function initBuildABundle() {
  const gridContainer = document.querySelector('.js-bundle-grid');
  if (!gridContainer) return;

  const maxItems = 6;
  let selectedItems = [];

  const cards = document.querySelectorAll('.js-pattern-card');
  const progressFill = document.querySelector('.js-progress-fill');
  const progressText = document.querySelector('.js-progress-text');
  const checkoutBtn = document.querySelector('.js-checkout-btn');
  const progressDots = document.querySelectorAll('.js-progress-dot');
  
  // Mobile / desktop floating elements
  const selectedCountText = document.querySelector('.js-selected-count');
  const bundleCheckoutBar = document.querySelector('.js-bundle-checkout-bar');

  // Load initial progress
  updateProgressBar();

  cards.forEach(card => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      
      const variantId = card.dataset.variantId;
      if (!variantId || variantId.trim() === '') {
        showNotification('This preview guide does not have an active variant in Shopify. Please add real products in Shopify Admin.', 'warning');
        return;
      }
      const index = selectedItems.indexOf(variantId);

      if (index > -1) {
        // Deselect item
        selectedItems.splice(index, 1);
        card.classList.remove('selected');
      } else {
        // Check if we hit the limit
        if (selectedItems.length >= maxItems) {
          showNotification('You can only select up to 6 guides for this bundle.', 'warning');
          return;
        }
        
        // Select item
        selectedItems.push(variantId);
        card.classList.add('selected');
      }

      updateProgressBar();
    });
  });

  function updateProgressBar() {
    const count = selectedItems.length;
    const percentage = (count / maxItems) * 100;
    
    // Update fill width
    if (progressFill) {
      progressFill.style.width = `${percentage}%`;
      if (count === maxItems) {
        progressFill.classList.add('complete');
      } else {
        progressFill.classList.remove('complete');
      }
    }

    // Update text indicators
    if (progressText) {
      progressText.textContent = `${count} of ${maxItems} Selected`;
    }
    if (selectedCountText) {
      selectedCountText.textContent = count;
    }

    // Update progress dots
    progressDots.forEach((dot, idx) => {
      if (idx < count) {
        dot.className = 'progress-dot completed';
      } else if (idx === count) {
        dot.className = 'progress-dot active';
      } else {
        dot.className = 'progress-dot';
      }
    });

    // Update checkout button state
    if (checkoutBtn) {
      if (count === maxItems) {
        checkoutBtn.removeAttribute('disabled');
        checkoutBtn.innerHTML = 'Add Bundle to Cart';
      } else {
        checkoutBtn.setAttribute('disabled', 'true');
        checkoutBtn.innerHTML = `Choose ${maxItems - count} more guide${maxItems - count > 1 ? 's' : ''}`;
      }
    }
  }

  // Handle Checkout Click (AJAX submission)
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      if (selectedItems.length !== maxItems) return;

      checkoutBtn.setAttribute('disabled', 'true');
      checkoutBtn.innerHTML = '<span class="loading-spinner">Preparing Checkout...</span>';

      // ── Step 1: Generate single unique bundleSessionId for all 6 items ─────
      // Exactly one ID is generated here and assigned to all 6 line items
      const bundleSessionId = Date.now().toString();

      // ── Step 2: Validate all 6 variant IDs and build items payload ──────────
      const itemsPayload = [];
      for (const variantId of selectedItems) {
        const parsedId = parseInt(variantId, 10);
        if (!parsedId || isNaN(parsedId)) {
          showNotification('One or more selected guides does not have a valid Shopify variant ID.', 'error');
          checkoutBtn.removeAttribute('disabled');
          checkoutBtn.innerHTML = 'Add Bundle to Cart';
          return;
        }
        itemsPayload.push({
          id: parsedId,
          quantity: 1,
          properties: {
            '_Bundle': 'Custom Bundle (Set of 6)',
            '_BundleID': bundleSessionId
          }
        });
      }

      // ── Step 3: Standalone Bundle Cart Isolation ────────────────────────────
      // Clear all previous cart items so the checkout contains ONLY the 6 bundle items.
      // This eliminates any prior items or old bundle configurations.
      fetch('/cart/clear.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Could not reset cart for bundle checkout.');
        }

        // ── Step 4: Add the exactly 6 real product variants ──────────────────
        return fetch('/cart/add.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ items: itemsPayload })
        });
      })
      .then(response => {
        // Read the body regardless of status so we can surface Shopify error messages
        return response.json().then(data => ({ ok: response.ok, status: response.status, data }));
      })
      .then(({ ok, status, data }) => {
        if (!ok) {
          const shopifyMsg = data.description || data.message || 'Unknown error from Shopify.';
          console.error('[Bundle] Cart error', status, data);

          if (status === 404) {
            showNotification('One or more selected guides could not be found. Please refresh and try again.', 'error');
          } else if (status === 422) {
            showNotification(shopifyMsg, 'error');
          } else {
            showNotification('Something went wrong. Please try again.', 'error');
          }

          checkoutBtn.removeAttribute('disabled');
          checkoutBtn.innerHTML = 'Add Bundle to Cart';
          return;
        }

        // ── Step 5: Direct Redirect to Shopify Checkout ──────────────────────
        // Standalone flow: bypass normal cart view and take customer directly to checkout
        window.location.href = '/checkout';
      })
      .catch(error => {
        console.error('[Bundle] Error during bundle checkout submission:', error);
        showNotification('Network error. Please check your connection and try again.', 'error');
        checkoutBtn.removeAttribute('disabled');
        checkoutBtn.innerHTML = 'Add Bundle to Cart';
      });
    });
  }
}

/* ==========================================================================
   Product Page Add to Cart (AJAX)
   ========================================================================== */
function initProductForm() {
  const form = document.getElementById('product-add-to-cart-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    // If submitter was dynamic checkout button (Buy Now), let Shopify handle it directly to /checkout
    if (e.submitter && e.submitter.getAttribute('name') !== 'add') {
      return;
    }

    e.preventDefault();
    const btn = form.querySelector('.js-add-to-cart');
    const originalText = btn ? btn.innerHTML : 'Add to Cart';

    if (btn) {
      btn.setAttribute('disabled', 'true');
      btn.innerHTML = '<span class="loading-spinner">Adding...</span>';
    }

    const formData = new FormData(form);

    fetch('/cart/add.js', {
      method: 'POST',
      headers: {
        'Accept': 'application/json'
      },
      body: formData
    })
    .then(response => {
      return response.json().then(data => ({ ok: response.ok, status: response.status, data }));
    })
    .then(({ ok, status, data }) => {
      if (!ok) {
        const errorMsg = data.description || data.message || 'Could not add product to cart.';
        showNotification(errorMsg, 'error');
        if (btn) {
          btn.removeAttribute('disabled');
          btn.innerHTML = originalText;
        }
        return;
      }

      // Update cart count badge in header
      fetch('/cart.js')
        .then(res => res.json())
        .then(cart => {
          const cartCount = document.querySelector('.js-header-cart-count');
          if (cartCount) {
            cartCount.textContent = cart.item_count;
            cartCount.style.animation = 'none';
            cartCount.offsetHeight; // trigger reflow
            cartCount.style.animation = 'scaleUp 0.3s ease-out';
          }
        })
        .catch(() => {});

      showNotification('Guide successfully added to your cart!', 'success');

      if (btn) {
        btn.removeAttribute('disabled');
        btn.innerHTML = '✓ Added to Cart';
        setTimeout(() => {
          btn.innerHTML = originalText;
        }, 2200);
      }
    })
    .catch(error => {
      console.error('[Product Form] Network error:', error);
      showNotification('Network error. Please try again.', 'error');
      if (btn) {
        btn.removeAttribute('disabled');
        btn.innerHTML = originalText;
      }
    });
  });
}

/* ==========================================================================
   Product Description Tabs
   ========================================================================== */
function initProductTabs() {
  const tabs = document.querySelectorAll('.js-tab-header');
  const contents = document.querySelectorAll('.js-tab-content');

  if (tabs.length === 0) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;

      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const activeContent = document.getElementById(`tab-${targetTab}`);
      if (activeContent) {
        activeContent.classList.add('active');
      }
    });
  });
}

/* ==========================================================================
   Thumbnail Gallery (Product Page)
   ========================================================================== */
function initThumbnailGallery() {
  const mainImage = document.querySelector('.js-main-product-image');
  const thumbnails = document.querySelectorAll('.js-thumbnail');

  if (!mainImage || thumbnails.length === 0) return;

  thumbnails.forEach(thumb => {
    thumb.addEventListener('click', () => {
      thumbnails.forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');

      const src = thumb.dataset.src;
      if (src) {
        mainImage.setAttribute('src', src);
      }
    });
  });
}

/* ==========================================================================
   Header Scroll State
   ========================================================================== */
function initHeaderScroll() {
  const header = document.querySelector('.js-site-header');
  if (!header) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 30) {
      header.classList.add('scrolled');
      header.style.boxShadow = '0 10px 30px rgba(43, 37, 32, 0.06)';
      header.style.background = 'rgba(250, 246, 240, 0.9)';
    } else {
      header.classList.remove('scrolled');
      header.style.boxShadow = 'none';
      header.style.background = 'rgba(250, 246, 240, 0.75)';
    }
  });
}

/* ==========================================================================
   Notification Helper
   ========================================================================== */
function showNotification(message, type = 'success') {
  // Create modal / toast dynamically
  let toast = document.querySelector('.theme-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'theme-toast';
    // Style toast dynamically
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '100px',
      right: '24px',
      padding: '16px 24px',
      borderRadius: '8px',
      color: '#2B2520',
      zIndex: '1000',
      boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
      fontWeight: '600',
      fontSize: '0.95rem',
      transform: 'translateY(150%)',
      transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      backdropFilter: 'blur(10px)',
      webkitBackdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.3)',
      maxWidth: '350px'
    });
    document.body.appendChild(toast);
  }

  // Set colors based on type
  if (type === 'success') {
    toast.style.background = 'rgba(232, 234, 230, 0.95)'; // Sage
    toast.style.borderColor = 'rgba(91, 112, 101, 0.3)';
  } else if (type === 'warning' || type === 'error') {
    toast.style.background = 'rgba(255, 235, 234, 0.95)'; // Pale Red
    toast.style.borderColor = 'rgba(211, 47, 47, 0.3)';
  }

  toast.textContent = message;
  toast.style.transform = 'translateY(0)';

  setTimeout(() => {
    toast.style.transform = 'translateY(150%)';
  }, 3500);
}
