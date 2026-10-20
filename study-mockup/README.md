# UniPlan Study tab concept

An isolated interactive mockup. Existing app files are unchanged.

## Preview

From this folder run `python3 -m http.server 8797 --bind 127.0.0.1`, then open http://127.0.0.1:8797.
You can also open index.html directly in a browser.

## Try it

1. Choose a sample class, edit or paste lecture notes, or append a .txt/.md file.
2. Set a future exam date and daily study time.
3. Build the study kit, then explore Study plan, Equations, Key notes and Practice.
4. Check off sessions, reveal recall cards, and reload to try browser-local persistence.
5. Reset demo restores the physics example.

## How this prototype operates

Everything runs locally. Lines with equation symbols become equation cards; longer remaining lines become key notes. Short headings become study topics. Up to seven sessions are spaced between today and the day before the exam, using the selected daily study duration. Practice cards reuse the source text. This is a rule-based interaction demo, not AI analysis or verified academic guidance. The sidebar shows placement of the proposed Study tab; other sidebar items are visual context.

Changing classes loads its sample notes, replacing the current editor contents. The prototype stores only the active study space in its own localStorage key. It does not access UniPlan account data, add calendar events or upload notes.

## Proposed full feature

Connect each study space to a real class, retain multiple note sources, extract PDF/document text and images, and use an AI service for topic importance, equation context and personalized plans. Retain source citations for review. Let students approve sessions before adding them to the existing calendar, then use completed sessions and practice feedback to adjust later reviews. Those integrations are not implemented here.

## Homework question bank and mock exams

Upload multiple `.txt`/`.md` homework files (up to 1 MB each), paste numbered questions, or choose **Try sample homework**. Number questions as `1.`, `2)`, or `Question 3:`. Continuation lines stay with the question; optional `Answer:` lines provide source answer keys. Duplicate question text is skipped. Review the extracted bank and select questions, then choose **Practice set** or **Mock exam** and a question count.

Practice sets allow answer reveals. Mock exams hide source answers until **Finish & review answers**. Responses and the current set save locally. Questions are shuffled copies of uploaded questions; new AI variations, auto-grading, timers, and PDF/Word/image extraction are not implemented. Switching classes or resetting clears the active homework bank along with the sample study space.

## Expected exam topics

In **Expected on the exam**, enter one topic or question type per line. Prefix a topic with `!` for extra review sessions. Rebuild the plan to replace the automatic topic list with your focus list. The schedule covers each listed topic first, then repeats high-priority topics more often where there is room. Simple keyword matching surfaces related notes/homework; unmatched topics prompt you to add source material. If there are more topics than available sessions, the plan lists topics not yet scheduled. The focus list saves in the browser and clears when switching sample classes or resetting.
