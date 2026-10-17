# Accessibility

The audience uses small Android phones, often one-handed on the road, with mixed literacy and in one of 13 languages. The UI is built for that first; screen-reader and keyboard support follow from the same choices.

## What the UI does

- **Touch targets**: every button, chip, tab and input is at least 44 px tall. Primary actions span the full width.
- **Labels**: every input has a visible `<label>` bound by `htmlFor`/`id`; placeholders are examples, never the only label.
- **Chips, not multi-selects**: work types and platforms are toggle buttons with `aria-pressed`, a visible tick on selection, and a text alternative for the state. Native multi-select lists are hard to use on phones.
- **Tabs**: the bottom navigation marks the current page with `aria-current="page"` and shows text under every icon.
- **Language and direction**: `<html lang>` follows the chosen language so screen readers pick the right voice; Urdu sets `dir="rtl"`. Each chat message carries its own `lang`.
- **Voice input**: the mic button has an `aria-label` that changes with state (speak, listening, stop), uses `aria-pressed` while recording, and renders nothing when the browser lacks `MediaRecorder` so no dead control is shown. Permission denial is explained inline.
- **Errors**: inline, next to the field, wrapped in `role="alert"` so they are announced; never colour-only.
- **Contrast**: dark text on light surfaces at AA contrast or better; focus rings are visible on every interactive element; no information is carried by colour alone.
- **Motion**: the only animation is the recording indicator pulse, and it is paired with elapsed-seconds text.
- **Reading level**: the model is instructed to use short, simple sentences in the worker's own language and script; UI chrome strings are short and avoid jargon.
- **Keyboard**: everything is reachable in DOM order; chips and the mic are real `<button>` elements; Enter submits forms and adds custom chips.

## Manual checklist

Run this on a phone and once with a screen reader (TalkBack on Android or VoiceOver on iOS) before a release:

1. Switch the language on the landing page to Tamil and to Urdu. Does every screen's chrome change, and does Urdu lay out right-to-left?
2. Tab through registration with a keyboard only. Can you select chips, add a custom platform and submit without a mouse?
3. With the screen reader on, record a voice note. Is each state announced?
4. Submit the login form with a wrong PIN. Is the error announced and visible next to the field?
5. Zoom the browser to 200%. Does anything overflow or get clipped?
6. Check the bottom tabs: is the current tab announced as current?
7. Check that the demo hint on the landing page is readable text, not an image.
