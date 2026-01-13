# Architecture

## Design Philosophy

tskill follows **Textual's Reactive Programming Model**, which is fundamentally different from traditional MVC or React-like patterns.

### Core Principle

Textual uses **reactive attributes** as the single source of truth. The pattern is:

```python
from textual.reactive import reactive

class MyApp(App):
    skills = reactive([])  # State
    count = reactive(0)
    
    def watch_skills(self, old_skills, new_skills) -> None:
        # Automatically called when skills changes
        self._update_table()
```

## Reactive Features

### 1. Automatic Refresh
When reactive attributes change, widgets automatically refresh. No manual update calls needed.

```python
self.skills = new_skills  # UI updates automatically
```

### 2. Smart Batching
Multiple reactive changes trigger only one refresh, minimizing render cycles.

```python
self.count += 1
self.total += 1
# Only one refresh, not two
```

### 3. Watch Methods
`watch_foo()` methods are automatically called when reactive attributes change:

```python
def watch_skills(self, old_skills, new_skills) -> None:
    # Respond to state changes
    self._update_table(new_skills)
```

### 4. Compute Methods
`compute_foo()` methods derive values from other reactive attributes:

```python
color = reactive(Color.parse("transparent"))
red = reactive(0)
green = reactive(0)
blue = reactive(0)

def compute_color(self) -> Color:
    return Color(self.red, self.green, self.blue)
```

### 5. Validation
`validate_foo()` methods guard against invalid values:

```python
def validate_count(self, count: int) -> int:
    if count < 0:
        return 0
    elif count > 10:
        return 10
    return count
```

## Actions System

### Action Methods
Methods prefixed with `action_` define user-triggered operations:

```python
def action_toggle_status(self) -> None:
    # Triggered by key press, link, or programmatic call
    pass
```

### Action Namespaces
- `app` - Actions on the app
- `screen` - Actions on the screen
- `focused` - Actions on the currently focused widget

## Recommended Patterns

### Pattern 1: Single Source of Truth
Store all state in reactive attributes. Avoid maintaining separate state.

```python
# Good
skills = reactive([])

# Bad
self.skills = []
self._skills_state = []
```

### Pattern 2: Let Watch Methods Handle UI Updates
Don't manually update widgets in action methods. Update reactive attributes and let watch methods handle the rest.

```python
# Good
def action_toggle_status(self) -> None:
    new_skills = [...modified_skills...]  # Update state
    self.skills = new_skills  # Watch handles UI

# Bad
def action_toggle_status(self) -> None:
    table = self.query_one(DataTable)
    table.update_cell(...)  # Manual update
    table.clear()
    table.add_rows(...)
```

### Pattern 3: Use Widget-Specific APIs for Targeted Updates
For DataTable, use `update_cell()` for single cell changes instead of full repopulation.

```python
# Good - Preserves cursor and is efficient
table.update_cell(row=row_index, column=1, value=new_status)

# Bad - Loses cursor and is slow
table.clear()
table.add_rows(...)
```

### Pattern 4: Conditional Recomposition
Use `recompose=True` for widgets that need full rebuilding:

```python
content = reactive("", recompose=True)  # Recompose on changes
```

### Pattern 5: Computed Properties
Derive values from other reactives instead of storing them:

```python
def compute_total_active(self) -> int:
    return sum(1 for skill in self.skills if skill.status == SkillStatus.ACTIVE)
```

## Anti-Patterns

### Anti-Pattern 1: Clear and Repopulate on Simple Changes
**Don't rebuild widgets when only values change.**

```python
# Bad - Loses cursor, inefficient
def action_toggle_status(self) -> None:
    table = self.query_one(DataTable)
    table.clear()
    table.add_rows(...)

# Good - Update cell directly
def action_toggle_status(self) -> None:
    table = self.query_one(DataTable)
    table.update_cell(row=row_index, column=1, value=new_status)
```

### Anti-Pattern 2: Stale State References
**Don't store references to child widgets.**

```python
# Bad - Stale after recompose
self.table = self.query_one(DataTable)  # Stored reference

def action_refresh(self):
    self.populate_table()  # Recreates widget, reference is stale

# Good - Query when needed
def action_refresh(self):
    table = self.query_one(DataTable)  # Current widget
    table.clear()
    table.add_rows(...)
```

### Anti-Pattern 3: Manual Widget Updates
**Don't manually call `update()` or `refresh()` on widgets.**

```python
# Bad - Manual refresh
def action_toggle_status(self) -> None:
    table = self.query_one(DataTable)
    table.update_cell(...)
    table.refresh()  # Redundant

# Good - Let reactivity handle it
def action_toggle_status(self) -> None:
    table = self.query_one(DataTable)
    table.update_cell(...)  # No manual refresh needed
```

## Implementation Guidelines

1. **Use reactive attributes for all app state**
2. **Update reactives, not widgets, in action methods**
3. **Implement `watch_*()` methods to respond to state changes**
4. **Use widget-specific APIs (like `update_cell()`) for targeted updates**
5. **Reserve full rebuilds for when data structure changes**
6. **Never store widget references that might become stale**
7. **Keep business logic in models/managers, UI logic in TUI**
