// =============================================================================
// Bundle $29 Discount — Shopify Function
// =============================================================================
//
// PURPOSE:
//   When a Shopify checkout begins, this Function runs server-side on Shopify's
//   infrastructure. It inspects all cart line items and:
//     1. Identifies lines tagged with _Bundle = "Custom Bundle (Set of 6)"
//     2. Verifies there are EXACTLY 6 such lines
//     3. Sums their real Shopify prices (server-side — cannot be spoofed)
//     4. Calculates the exact discount: SUM − $29.00
//     5. Applies that discount ONLY to the 6 bundle lines
//     6. Leaves all other lines completely untouched
//
// RESULT AT CHECKOUT:
//   Bundle items (6) = $29.00 regardless of their individual prices
//   Unrelated items  = their normal full prices
//
// FILEMONK COMPATIBILITY:
//   The 6 real variant IDs remain as individual line items in the Shopify order.
//   Filemonk reads variant IDs from order line items — this is unaffected by discounts.
//
// =============================================================================

// The line item property value that the theme sets on each bundle item
// Must match exactly what assets/theme.js sets in the _Bundle property.
const BUNDLE_PROPERTY_VALUE = 'Custom Bundle (Set of 6)';

// The required number of bundle items
const REQUIRED_BUNDLE_COUNT = 6;

// The fixed target bundle price in cents ($29.00 = 2900¢)
const BUNDLE_TARGET_PRICE_CENTS = 2900;

// Returned when no discount should be applied (e.g. wrong count of bundle items)
const NO_DISCOUNT = { discounts: [], discountApplicationStrategy: 'FIRST' };

/**
 * Main Function entry point.
 * Called by Shopify's checkout engine for every checkout session.
 *
 * @param {Object} input - Cart data injected by Shopify per input.graphql
 * @returns {Object} FunctionResult — either an empty discount or the $29 adjustment
 */
export function run(input) {
  const lines = input.cart.lines;

  // ── Step 1: Find all cart lines tagged as bundle items ──────────────────────
  const bundleLines = lines.filter(
    (line) => line.attribute?.value === BUNDLE_PROPERTY_VALUE
  );

  // ── Step 2: Guard — must be EXACTLY 6 bundle items and NO unrelated items ───
  // The Build-a-Bundle purchase is a standalone checkout of exactly 6 items.
  // If there are fewer or more bundle items, or if ANY unrelated items exist in the cart,
  // apply NO discount. This prevents combining unrelated products with the bundle.
  if (bundleLines.length !== REQUIRED_BUNDLE_COUNT || lines.length !== REQUIRED_BUNDLE_COUNT) {
    return NO_DISCOUNT;
  }

  // ── Step 3: Sum the real prices of all 6 bundle lines ──────────────────────
  // cost.totalAmount.amount is a string like "7.00" provided by Shopify.
  // Convert to cents (integer) to avoid floating-point rounding errors.
  const bundleTotalCents = bundleLines.reduce((sum, line) => {
    const amountCents = Math.round(
      parseFloat(line.cost.totalAmount.amount) * 100
    );
    return sum + amountCents;
  }, 0);

  // ── Step 4: Calculate the discount needed to reach exactly $29.00 ──────────
  const discountCents = bundleTotalCents - BUNDLE_TARGET_PRICE_CENTS;

  // Guard — if the 6 items already total $29 or less, no discount is needed
  // (This would be an unusual edge case but must be handled.)
  if (discountCents <= 0) {
    return NO_DISCOUNT;
  }

  // Convert back to decimal string for Shopify's API (e.g. 1800 → "18.00")
  const discountAmount = (discountCents / 100).toFixed(2);

  // ── Step 5: Build the Function output ──────────────────────────────────────
  // Target all 6 bundle line IDs with a single fixed-amount discount.
  // appliesToEachItem: false → the total discount is spread proportionally
  // across all 6 targeted lines (not $18 per item — $18 total across all 6).
  return {
    discounts: [
      {
        targets: bundleLines.map((line) => ({
          cartLine: { id: line.id },
        })),
        value: {
          fixedAmount: {
            amount: discountAmount,
            appliesToEachItem: false,
          },
        },
        message: 'Build-a-Bundle: 6 Guides for $29',
      },
    ],
    discountApplicationStrategy: 'FIRST',
  };
}
