// Spread onto answer boxes (<input {...NO_SUGGEST} />) so the browser and the
// phone keyboard don't pop up their own suggestions, autofill, autocorrect or
// spell-check over the person's answer. Browsers differ in which of these they
// respect, so all of them are set. The 1Password / LastPass / form-type flags
// keep password managers from decorating the box too.
export const NO_SUGGEST = {
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
  'data-lpignore': 'true',
  'data-1p-ignore': 'true',
  'data-form-type': 'other',
};
