# Compact language control

Keep one-click SQ / EN / DE selection, persistence and translation unchanged. Remove the globe and visible caption. Use a 28px-tall orange segmented control, placed immediately before search in both header layouts. Remove the second mobile row and its body offset. On phones show Dardani as its existing face button with its accessible label; all controls remain visible without horizontal overflow at 320px and above.

Tasks are appended as a separate section in tasks/todo.md, preserving the unrelated incomplete trade-page work.

1. Update switcher, navbar placement and responsive CSS (three files).
2. Review complete diff read-only for regressions. Run existing language tests and npm run build. Verify rendered layouts at 320, 390, 768, 1024 and 1440px, language clicks and search/menu access.
3. Commit intended files; push origin/main for Railway GitHub deployment. Check exact production SHA and repeat desktop/mobile visual checks; save screenshots.
