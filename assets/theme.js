/**
 * Premium Crochet Theme JS
 * Handles Build-a-Bundle selection, AJAX Cart integration, and UI Micro-interactions.
 */

document.addEventListener('DOMContentLoaded', () => {
  initBuildABundle();
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
      const index = selectedItems.indexOf(variantId);

      if (index > -1) {
        // Deselect item
        selectedItems.splice(index, 1);
        card.classList.remove('selected');
      } else {
        // Check if we hit the limit
        if (selectedItems.length >= maxItems) {
          showNotification('You can only select up to 6 patterns for this bundle.', 'warning');
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
        checkoutBtn.innerHTML = `Choose ${maxItems - count} more pattern${maxItems - count > 1 ? 's' : ''}`;
      }
    }
  }

  // Handle Checkout Click (AJAX submission)
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      if (selectedItems.length !== maxItems) return;

      checkoutBtn.setAttribute('disabled', 'true');
      checkoutBtn.innerHTML = '<span class="loading-spinner">Adding Bundle...</span>';

      // Prepare items for AJAX cart payload
      const itemsPayload = selectedItems.map(variantId => ({
        id: parseInt(variantId, 10),
        quantity: 1,
        properties: {
          '_Bundle': 'Custom Crochet Bundle (Set of 6)'
        }
      }));

      // AJAX call to Shopify Cart
      fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ items: itemsPayload })
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        showNotification('Bundle successfully added to your cart!', 'success');
        // Redirect to cart or drawer-open
        setTimeout(() => {
          window.location.href = '/cart';
        }, 800);
      })
      .catch(error => {
        console.error('Error adding bundle to cart:', error);
        showNotification('Something went wrong. Please try again.', 'error');
        checkoutBtn.removeAttribute('disabled');
        checkoutBtn.innerHTML = 'Add Bundle to Cart';
      });
    });
  }
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
