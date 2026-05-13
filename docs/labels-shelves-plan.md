# OffReader: Shelves & Labels Feature

## Overview

Two organizational concepts for books:
1. **Shelves** - Single assignment per book (like folders)
2. **Labels** - Multiple tags per book (descriptive)

---

## Data Model

### New Types

```typescript
interface Label {
  id: string;
  name: string;
  color: string; // hex color
}

interface Shelf {
  id: string;
  name: string;
  isDefault: boolean;
  order: number;
}
```

### Book Updates

```typescript
interface Book {
  // ... existing fields
  shelfId: string | null;  // which shelf, null = unassigned
  labelIds: string[];      // which labels applied, empty = none
}
```

### Storage Keys

| Key | Content |
|-----|---------|
| `offreader-labels` | Array of Label objects |
| `offreader-shelves` | Array of Shelf objects |
| `offreader-books` | Updated with shelfId + labelIds fields |

### Migration

- Existing books: `shelfId = null`, `labelIds = []`

---

## Derived Data (No Storage Needed)

### Reading Status

Computed from existing `progress` + `isFinished` fields:

| Status | Condition |
|--------|-----------|
| Unread | `!isFinished && progress === 0` |
| In Progress | `!isFinished && progress > 0` |
| Read | `isFinished === true` |

---

## Default State (First Launch)

### Shelves
- One default "Library" shelf (cannot be deleted, always exists)
- `isDefault = true`

### Labels
- Empty by default, user creates as needed

### New Book Import
- `shelfId = null` (unassigned) unless user sets a default shelf
- `labelIds = []`

---

## Operations (CRUD)

### Labels

| Action | Behavior |
|--------|----------|
| Create | Add new label with name + color |
| Edit | Update name/color of existing label |
| Delete | Remove label from all books' labelIds, then delete |

### Shelves

| Action | Behavior |
|--------|----------|
| Create | Add new shelf, user picks name |
| Edit | Rename shelf |
| Delete | If books on shelf → prompt user to move to another shelf OR mark unassigned. If no books → direct delete. Cannot delete last remaining shelf. |
| Set Default | One shelf marked as default for new imports |
| Reorder | Change display order of shelves |

### Books

| Action | Behavior |
|--------|----------|
| Assign to Shelf | Set book's shelfId to a shelf |
| Unassign | Set book's shelfId to null |
| Add Label | Add labelId to book's labelIds |
| Remove Label | Remove labelId from book's labelIds |

---

## Filters (Library View)

| Filter | Source | Options |
|--------|--------|---------|
| Shelf | book.shelfId | All Books / [Shelf Name] / Unassigned |
| Label | book.labelIds | All Labels / [Label Name] |
| Reading Status | progress + isFinished | All / Unread / In Progress / Read |

**Behavior:** Filters combine (AND logic) - e.g., "Fantasy shelf" AND "In Progress"

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Delete shelf with books | Prompt: move books to another shelf OR mark as Unassigned |
| Delete shelf (no books) | Direct delete, no prompt |
| Delete last remaining shelf | Prevented - must have at least one shelf |
| Duplicate shelf name | Validation error on create/edit |
| Book with no shelfId | "Unassigned" - appears in "All Books" but not in any specific shelf filter |
| Filter by shelf with no books | Empty state shown |
| Delete label | Cascade remove from all books' labelIds |

---

## UI Scope (Future Discussion)

- Label display on BookCard
- Shelf/Labels on BookDetails
- Library filter controls (shelf, label, status)
- Add book dialog with shelf selector
- Settings/Management page for Labels and Shelves

---

## Notes

- Hitting 100% progress auto-sets `isFinished = true`
- "Mark as Finished" toggle in BookDetails sets `isFinished = true` and `progress = 100`
- Existing `isFinished` field in book tracker already exists - no new storage needed for status