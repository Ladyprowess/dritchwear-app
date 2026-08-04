<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Dritchwear Expo app. The SDK (`posthog-react-native` v4.54.4) was already installed. The wizard verified and confirmed the existing setup (PostHogProvider in `app/_layout.tsx`, manual screen tracking via `usePathname`, user identification on login/register, `posthog.reset()` on sign-out, and env vars in `.env`), then added the missing conversion events (`checkout_started`, `order_placed` for both wallet and card payments), a `wallet_funded` event on successful Paystack top-up, and `captureException` error tracking in the checkout and login flows.

| Event name | Description | File |
|---|---|---|
| `user_signed_in` | User successfully logs in with email and password. | `app/(auth)/login.tsx` |
| `user_registered` | New user completes registration, with optional referral code. | `app/(auth)/register.tsx` |
| `user_signed_out` | User signs out from the app. | `contexts/AuthContext.tsx` |
| `product_viewed` | User opens a product detail modal from the shop. | `app/(customer)/shop.tsx` |
| `product_searched` | User submits a search query in the shop. | `app/(customer)/shop.tsx` |
| `wishlist_item_added` | User adds a product to their wishlist. | `app/(customer)/shop.tsx` |
| `product_added_to_cart` | User adds a product with size and color to the cart. | `components/ProductModal.tsx` |
| `cart_viewed` | User opens the cart screen. | `app/(customer)/cart.tsx` |
| `checkout_started` | User arrives at checkout with items loaded from the cart. | `app/(customer)/checkout.tsx` |
| `promo_code_applied` | User successfully applies a promo code at checkout. | `app/(customer)/checkout.tsx` |
| `order_placed` | User successfully completes an order via wallet or card payment. | `app/(customer)/checkout.tsx` |
| `pay_for_me_link_created` | User generates a Pay for Me payment link for their order. | `app/(customer)/checkout.tsx` |
| `wallet_funded` | User successfully tops up their wallet via Paystack. | `app/(customer)/fund-wallet.tsx` |
| `custom_order_submitted` | User submits a custom clothing order request. | `app/(customer)/custom-order.tsx` |
| `bill_payment_initiated` | User initiates a VTpass bill payment (airtime, data, utility). | `app/(customer)/bill-payment.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) - Dashboard](https://eu.posthog.com/project/216610/dashboard/795433)
- [Checkout conversion funnel (wizard)](https://eu.posthog.com/project/216610/insights/SizaoDuq)
- [Orders placed over time (wizard)](https://eu.posthog.com/project/216610/insights/21GnW2ZY)
- [New user registrations (wizard)](https://eu.posthog.com/project/216610/insights/TNnCkaYZ)
- [Promo code usage (wizard)](https://eu.posthog.com/project/216610/insights/vP0b6NPw)
- [Wallet funding (wizard)](https://eu.posthog.com/project/216610/insights/SUA0Eiyn)

## Verify before merging

- [ ] Run a full production build (the wizard only verified the files it touched) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite - call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` to `.env.example` and any EAS build secrets so collaborators and CI know what to set.
- [ ] Confirm the returning-visitor path also calls `identify` - a handler that only identifies on fresh login can leave returning sessions on anonymous distinct IDs.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
