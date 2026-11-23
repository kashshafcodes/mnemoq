import ReviewCard from './ReviewCard';
import Jonaki from './Jonaki';
import { dailyStatus } from '../daily/DailyTile';
import { ReviewSubjectTabs, SessionStart, SessionSummary } from './SessionPanels';
import { SESSION_SIZE } from '../quiz';
import { sameName } from '../subjects';
import { pageHref } from '../useRoute';

// The Review page: pick a subject, run a short session, see how it went.
export default function ReviewPage({
  pathInfo,
  reviewMistake,
  sessionFinished,
  reviewTabs,
  activeReviewSubject,
  reviewSubjectFromPath,
  dueMistakes,
  chooseReviewSubject,
  sessionRunning,
  endSession,
  mistakes,
  manualReviewId,
  reviewSession,
  handleReviewRating,
  scopedDue,
  startSession,
  setReviewSession,
}) {
  return (
    <>
      <section className="review-section" id="review">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ACTIVE RECALL</p>
            <h2>Review your cards</h2>
            <p>Pick or type your answer first. Recalling it beats re-reading it.</p>
          </div>
        </div>

        {pathInfo && !reviewMistake && !sessionFinished && (
          <div className="review-path">
            <span>
              <b>{pathInfo.short} prep</b>
              {pathInfo.daysLeft !== null && ` · ${pathInfo.daysLeft} ${pathInfo.daysLeft === 1 ? 'day' : 'days'} left`}
              {pathInfo.readiness !== null && ` · ${pathInfo.word} ${pathInfo.readiness} of ${pathInfo.target}`}
            </span>
            {pathInfo.weakest &&
              reviewTabs.some((tab) => sameName(tab.name, pathInfo.weakest.cardSubject)) &&
              !sameName(activeReviewSubject, pathInfo.weakest.cardSubject) && (
                <button type="button" className="text-link" onClick={() => reviewSubjectFromPath(pathInfo.weakest.cardSubject)}>
                  Focus on {pathInfo.weakest.name}, your weakest
                </button>
              )}
            <a className="text-link" href={pageHref('path')}>
              Open my path
            </a>
          </div>
        )}

        {!reviewMistake && !sessionFinished && (
          <ReviewSubjectTabs tabs={reviewTabs} active={activeReviewSubject} totalDue={dueMistakes.length} onChange={chooseReviewSubject} />
        )}

        {reviewMistake ? (
          <>
            {sessionRunning && (
              <div className="session-bar">
                <span>{activeReviewSubject ? `${activeReviewSubject} session` : 'Short session'}</span>
                <button type="button" className="text-link" onClick={endSession}>
                  End session
                </button>
              </div>
            )}
            <ReviewCard
              key={`${reviewMistake.id}-${reviewMistake.reviewCount || 0}`}
              card={reviewMistake}
              cards={mistakes}
              position={{
                index: manualReviewId !== null ? 0 : reviewSession.results.length,
                total: manualReviewId !== null ? 1 : reviewSession.ids.length,
              }}
              onRate={handleReviewRating}
            />
          </>
        ) : sessionFinished ? (
          <SessionSummary
            results={reviewSession.results}
            cards={mistakes}
            moreDue={scopedDue.length}
            onAgain={startSession}
            onDone={() => setReviewSession(null)}
          />
        ) : scopedDue.length > 0 ? (
          <SessionStart dueCards={scopedDue} subject={activeReviewSubject} sessionSize={SESSION_SIZE} onStart={startSession} />
        ) : (
          <div className="review-empty-state">
            <Jonaki mood="sleep" size={84} />
            <h3>{activeReviewSubject ? `${activeReviewSubject} is all caught up!` : "You're all caught up!"}</h3>
            <p>{activeReviewSubject ? `No ${activeReviewSubject} cards are due right now.` : 'No cards are due for review right now.'}</p>
            <p>
              {activeReviewSubject
                ? dueMistakes.length > 0
                  ? 'Pick another subject above to keep going.'
                  : "They'll return to your review queue when they're due."
                : `You have ${mistakes.length} saved card${mistakes.length === 1 ? '' : 's'} in your library. They'll return to your review queue when they're due.`}
            </p>
            {!dailyStatus().today && (
              <a className="mq-btn mq-btn-ghost" href="/daily">
                Play today’s Daily puzzle while you wait
              </a>
            )}
          </div>
        )}
      </section>
    </>
  );
}
