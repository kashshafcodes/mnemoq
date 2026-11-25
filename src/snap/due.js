// New cards are due right away, snapped and offline-saved ones included, like
// Quick add (owner's decision, 25 Nov night, reversing Snap spec decision 3):
// practising at once is what makes the student feel "it works". "Try it now"
// stays one tap away.
//
// The app's cards store "due now" as no review date at all (next_review_at
// null), the same as Quick add, so a new card joins Today's round at once.
export function firstReviewAt() {
  return null;
}
