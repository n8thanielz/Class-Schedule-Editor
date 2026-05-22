# Schedule Visualizer — Editor

A browser-based tool for visualizing and editing university department class schedules exported from the [University of Utah CLSS system](https://clss.utah.edu/wen/). Upload a CSV export to get an interactive weekly grid with filtering, editing, conflict detection, and multi-format export.

---

## Live App

**[https://n8thanielz.github.io/Class-Schedule-Editor/](https://n8thanielz.github.io/Class-Schedule-Editor/)**

---

## Getting Started (Local)

The app runs entirely in the browser — no build step required.

```bash
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

---

## How to Use

1. Go to [clss.utah.edu/wen](https://clss.utah.edu/wen), open your department's schedule, and export as **CSV**.
2. Upload the file. You can select multiple files at once to combine departments into a single view.
3. Use the sidebar to filter courses and instructors.
4. Use **Edit Mode** to drag sections to new time slots or click them to edit details.
5. Export your changes as CSV (for CLSS import) or Excel (color-coded change summary).

---

## Features

### Schedule Grid
- Weekly grid showing all in-person sections, color-coded by course
- Online / asynchronous sections shown in a separate panel below the grid
- Day columns auto-hide when no sections are scheduled on that day
- Blocks show course number, instructor, time, room, and date range based on available height
- 1st Half, 2nd Half, and Miscellaneous sessions display their date ranges on the block

### Conflict Detection
- **Instructor conflicts** — sections where the same instructor is scheduled in overlapping time slots are highlighted with a red border and red instructor name
- **Room conflicts** — sections sharing the same assigned room at overlapping times are highlighted the same way
- Both conflict types respect session date ranges (1st Half / 2nd Half sections in the same slot don't false-fire)
- A warning modal appears before any export listing all detected conflicts by type

### Edit Mode
Activate via the **Edit Mode** toolbar button.

- **Drag to reschedule** — drag a section block to a new time slot; it snaps to standard University of Utah time blocks (MW or TTh patterns). Cross-day drags (e.g. MW → TTh) show a ghost indicator in the target columns. The room is automatically set to *Request General Assignment* on a successful move.
- **Click to edit** — opens a modal to change course, section number, type, instructor, room, room cap request, delivery method, session, days, and time
- **Add Section** — create a new section from scratch under any existing course or a new course
- **Mark Cancelled** — flags a section for cancellation in the export without removing it from the view
- **Revert to Original** — undo all edits to a section and restore its imported values
- **Inline title editing** — click the schedule title to rename it

### Sidebar
- **Saved Presets** — save and name filter configurations (course + instructor state) for one-click reuse; presets persist across sessions
- **Filter Courses** — show/hide individual courses grouped by department and level; color picker per course
- **Filter by Instructor** — show/hide by instructor; per-instructor **Print** and **iCal** export buttons

### Toolbar
| Button | Description |
|--------|-------------|
| **Print** | Prints the current filtered view; auto-detects landscape |
| **Export PDF** | Saves the current view as a PDF via html2canvas |
| **Calendar** | Exports the current view as a `.ics` calendar file |
| **Export CSV** | Exports changes back to CLSS-compatible CSV files (one per department) |
| **Export Excel** | Exports a color-coded Excel workbook summarizing all changes |
| **Edit Mode** | Toggles the section editor |
| **+ Add Section** | *(Edit Mode only)* Add a new section |
| **Hide Online** | Toggles the asynchronous sections panel |
| **+ Add File** | Add another department's CSV to the current view |
| **↑ Upload New** | Start over with a new file |

### CSV Export
- Produces one CSV file per loaded department, formatted for re-import into CLSS
- Cancelled sections are preserved in the file with status `Cancelled`
- Modified sections reflect updated fields (room, instructor, time, etc.)
- New sections are appended under their course header

### Excel Export
Color-coded change summary for easy review before submitting to the registrar:

| Color | Meaning |
|-------|---------|
| Yellow | Modified section |
| Green | New section |
| Red / strikethrough | Cancelled section |
| White | Unchanged |

A **Changes** column summarizes which fields were modified (e.g. *Room, Meeting Pattern*).

### iCal Export
- Per-instructor export from the sidebar generates `LastName_Semester.ics` with weekly recurring events
- Toolbar Calendar export generates a single `.ics` for everything currently visible
- Both include instructor, room, and full session date range
- Requires a CSV export — date range data is not available from PDFs

---

## File Format

CSV exports from CLSS are required. The app detects the header row automatically and works with both the full and condensed export formats from CLSS.

The **Session** column is used to detect 1st Half, 2nd Half, and Miscellaneous sessions and display their date ranges on grid blocks.

---

## Tech Stack

- Vanilla HTML / CSS / JavaScript — no framework or build tooling
- [pdf.js](https://mozilla.github.io/pdf.js/) — PDF parsing (for basic grid view)
- [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) — PDF export
- [xlsx-js-style](https://github.com/gitbrent/xlsx-js-style) — Excel export with cell styling

---

## Credits

&copy; 2026 Nathaniel J. Zwart
