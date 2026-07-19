# rCodexManager Option 2 Overall Workbench QA

## Source Visual

- Selected direction: option 2, category workbench with grouped saved filters.
- Source image: `/Users/ikiru/.codex-r/generated_images/019f5a2f-3917-7ec2-934b-de3e8f251737/ig_05c6eb11f9a58d5c016a55913a1f548191b34ca144cdebf1c7.png`

## Implementation Evidence

- Local preview: `http://127.0.0.1:1438/`
- Implementation screenshot: `/Users/ikiru/Documents/r-series-public/rcodexmanager/tmp/qa-fixed-action-column-scrolled.png`
- Full-view comparison: `/Users/ikiru/Documents/r-series-public/rcodexmanager/tmp/qa-option2-overall-comparison-queried.png`
- Viewport: 1440 x 1024, light mode, rDevTool selected, quota queried.
- Build verification: `npm run web:build` passed.
- Console: no console messages found in the browser.

## Primary Interactions Tested

- Category dropdown: selecting `upi` reduced the list to 2 profiles, then returning to `全部` restored 8 profiles.
- Selection sync: when the active profile was filtered out, the inspector switched to the first visible profile.
- Quota action: `查额度` populated the quota block in the inspector.
- Compact pass: command cards, filters, profile rows, inspector buttons, and secondary actions were reduced without clipping visible labels.
- List simplification: profile rows no longer render model/reasoning tags or the session rename tag.
- List actions: add and refresh buttons now sit at the far right of the status-filter row.
- Inspector behavior: collapsed inspector expands on profile-row pointer/click selection, then shows the clicked profile.
- Filter layout: search now flexes to fill the row, with a compact category dropdown on the right.
- Table actions: launch/terminate buttons now live in a fixed right-side operation column with its own header and divider, and stay aligned during horizontal scroll.
- List header cleanup: the redundant `Profile 列表` toolbar row was removed so the table header starts at the top of the list surface.
- Manager dialogs: auth vault, session center, and WeChat bridge now share the same modal shell, title toolbar, input density, pane styling, selected-row language, and light/dark material treatment.

## Findings

- No P0/P1/P2 mismatches remain.
- Fonts and typography: the implementation uses the existing product type scale and keeps the source hierarchy: bold profile names, compact metadata, and readable Chinese labels.
- Spacing and layout rhythm: the final layout matches the selected split workbench pattern, with top utility cards, category filters, status filters, row-based profile table, and action-first inspector.
- Colors and visual tokens: the implementation preserves the existing soft light shell, gray-blue borders, muted text, green running states, and accent selected states.
- Image and icon fidelity: no raster assets were required. Icons come from the MUI icon set already used by the app.
- Copy and content: category retrieval labels, status filters, profile rows, rDevTool inspector, paths, account, session, and quota content are present and readable.

## Comparison History

- Earlier issue: status text in the profile table rendered as a second dot because the CSS selector targeted every direct `span`.
  Fix: added a dedicated `.profile-status-dot` element and scoped dot styling to that class.
- Earlier issue: category filters were partially clipped at the default desktop width.
  Fix: reduced search-column max width and tightened category chip padding.
- Earlier issue: filtering by category left the inspector on a hidden profile.
  Fix: when the current selection is filtered out, the inspector now selects the first visible result.
- Earlier issue: the top workbench controls were too compressed compared with the selected visual direction.
  Fix: increased command-card, search, category, and status-filter heights for a calmer workbench rhythm.
- Later user feedback: cards and buttons still felt too heavy.
  Fix: reduced command-card height, search/filter heights, profile row density, inspector hero padding, primary action height, path/session/quota card padding, and secondary action height. Rechecked at 1440 x 1024 with no visible clipping.
- Later user feedback: the list did not need to show model tags or the session rename marker.
  Fix: changed the table header to `分类`, kept only the category chip in each row, removed the session `重命名` marker, and rebalanced row columns so account and recent session text get more space. Rechecked at 1440 x 1024 with no model/rename text present and no clipped row cells.
- Later user feedback: add and refresh belonged at the top-right of the list.
  Fix: moved both buttons out of the page header into a compact profile-list toolbar, keeping the same icon-button styling. Rechecked in dark mode at 1440 x 1024; actions are inside the list panel, the title area has no duplicate actions, and the console has no messages.
- Later user feedback: the right sidebar was too wide and collapsed state should recover when selecting a list row.
  Fix: reduced the inspector column from a 370-420px range to a 320-360px range, tightened the 1040px breakpoint, and expanded the inspector when a profile row is selected. Rechecked by collapsing the inspector, clicking `codex-g`, and confirming the inspector reopened at 360px with no clipped sidebar controls.
- Later user feedback: the category/type filter should become a compact dropdown and the search field should stretch.
  Fix: replaced the horizontal category chip strip with a 132px `分类筛选` dropdown that preserves option counts, changed the filter row to a flexible search field plus dropdown, and kept status filters on the next row. Rechecked `upi` selection, default `全部` state, no clipping, and no console messages.
- Later user feedback: `收起侧栏 -> 点击 codex-g 行` did not reopen the inspector reliably.
  Fix: centralized row selection through `selectProfileAndOpenInspector` and added pointer-down selection on the row's main button so the inspector opens as soon as the row is pressed, before the normal click event completes. Rechecked by collapsing the inspector, clicking the `codex-g` row through the browser, and confirming the inspector reopened with `codex-g` visible.
- Later user feedback: add and refresh should be on the same row as `全部 / 运行中`.
  Fix: moved the add and refresh icon buttons from the profile-list toolbar to the far right of the status-filter strip. Rechecked in light mode at 1440 x 1024; the buttons share the same row as the status filters, align to the right edge, the list title row has no actions, and there is no clipping.
- Later user feedback: row launch buttons should feel like an Element Plus `el-table` fixed right operation column.
  Fix: added an `操作` table header, widened the action column to 56px, gave the column a sticky right alignment, left divider, independent background, and centered action buttons. Rechecked at 1440 x 1024; the operation header and row buttons align to the right edge, status text is not covered, buttons are centered, and there is no clipping.
- Later user feedback: horizontal scrolling caused the fixed operation column to misalign with the status column.
  Fix: moved the profile table header into the same horizontal scroll container as the rows, split the header into `profile-header-main` plus the sticky action header, and shared table column variables across header and row bodies. Rechecked at 760 x 900 by scrolling the list fully right; `状态` header/row cells align, `操作` header/row cells align, status text remains before the action column, and there is no clipping.
- Later user feedback: the `Profile 列表` row at the top of the list was not useful.
  Fix: removed the list toolbar row and changed the list surface grid to two rows: scrollable table plus pagination. Rechecked at 760 x 900; the table header is the first row in the list surface and no empty toolbar remains.
- Later user feedback: design the auth vault dialog in light/dark styles and apply the same UI rules to session center and WeChat bridge.
  Fix: introduced shared `manager-dialog` styling across all three management dialogs, raised the modal to a 900px desktop canvas, unified title/tool/pane/list/detail materials, and added shared selected-row, chip, button, and input density rules. Opening a manager dialog now blurs the background command button first, removing the browser's aria-hidden focus warning. Captured final UI style images at 1440 x 1024:
  `tmp/auth-vault-style-light-final.png`, `tmp/auth-vault-style-dark-final.png`, `tmp/session-center-manager-style.png`, and `tmp/wechat-bridge-manager-style.png`. Build verification passed with `npm run web:build`; console only showed Vite/React dev messages.

## Follow-Up Polish

- P3: the implementation shows an eighth mock profile (`codex-r`) to exercise the count state; the source visual only shows seven visible rows despite an `8` count.
- P3: quota content uses the app's actual two-window quota report instead of the mock's single spend-style meter.

final result: passed
