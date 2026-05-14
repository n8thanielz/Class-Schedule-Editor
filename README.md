# Schedule Visualizer

A browser-based tool for visualizing university department class schedules exported from the [University of Utah CLSS system](https://clss.utah.edu/wen/). Upload a PDF or CSV export and get an interactive weekly grid with filtering, printing, and calendar export.

---

## Live App

**[https://n8thanielz.github.io/schedule-visualizer/](https://n8thanielz.github.io/schedule-visualizer/)**

---

## Getting Started (Local)

The app runs entirely in the browser — no build step required.

**Option A — Local server (recommended)**

Double-click `start-server.bat`, or run manually:

```bash
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

> A local server is required because the PDF parser uses web workers, which browsers block over `file://`.

**Option B — Static hosting**

Deploy the folder to any static host (GitHub Pages, Netlify, etc.) — no server-side code needed.

---

## How to Use

1. Go to [clss.utah.edu/wen](https://clss.utah.edu/wen), open your department's schedule, and export as **PDF** or **CSV**.
2. Upload the file. You can select multiple files at once to combine departments into a single view.
3. Use the sidebar to filter courses and instructors. Use the toolbar to print, export, or download a calendar file.

---

## Features

### Schedule View
- Weekly grid showing all in-person sections, color-coded by course
- Online / asynchronous sections shown in a separate panel below the grid
- Day columns auto-hide when no sections are scheduled on that day

### Sidebar
- **Saved Presets** — save and name filter configurations (e.g. program tracks) for one-click reuse; presets persist across sessions and work across different uploaded files
- **Filter Courses** — show/hide individual courses grouped by department and level; color picker per course
- **Filter by Instructor** — show/hide by instructor; per-instructor Print and iCal export buttons

### Toolbar
- **Print** — prints the current view; auto-detects landscape orientation for wide schedules
- **Export PDF** — exports the current view as a PDF file using html2canvas + jsPDF
- **Calendar** — exports the current filtered view as a `.ics` calendar file (requires CSV upload for date range data)
- **Hide Online** — toggles the asynchronous sections panel; preference is saved across sessions
- **+ Add File** — add another department's schedule to the current view
- **↑ Upload New** — start over with a new file

### Persistence
Filter states, course colors, and the online panel toggle are saved in `localStorage` and restored on next load.

### iCal Export
- Per-instructor export from the sidebar generates `LastName_Semester.ics` with weekly recurring events
- Toolbar Calendar export generates a single `.ics` for everything currently visible
- Both include instructor, room, and session date range; requires a CSV export (PDFs do not contain date range data)

---

## File Format Notes

| Format | Grid | Filters | iCal dates |
|--------|------|---------|------------|
| PDF    | ✓    | ✓       | ✗          |
| CSV    | ✓    | ✓       | ✓          |

CSV exports from CLSS include a **Session** column with start/end dates, which enables iCal export. PDF exports do not contain this data.

---

## Tech Stack

- Vanilla HTML / CSS / JavaScript — no framework or build tooling
- [pdf.js](https://mozilla.github.io/pdf.js/) — PDF parsing
- [html2canvas](https://html2canvas.hertzen.com/) + [jsPDF](https://github.com/parallax/jsPDF) via html2pdf.js — PDF export
