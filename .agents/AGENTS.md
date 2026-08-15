## Local Architecture Documentation
- **Rule**: Never attempt to aggregate project-specific architecture documentation into a single global file.
- **Requirement**: For all projects, maintain a local `architecture.md` file in the project's root directory.
- **Format Content**: This file MUST contain:
  1. A clear overview of the tech stack.
  2. Integration patterns (e.g., BFF, auth flows).
  3. A 'Tradeoffs Accepted' table with columns: `Decision`, `Alternative Considered`, and `Why We Accepted This`.
- **Trigger**: Update this file whenever making significant architectural decisions or accepting notable technical tradeoffs.

## Centralised Knowledge Files
- **Rule**: When the user asks to update or add to the "interview talking points", "upcoming tasks", or "learning journal" files, always write to the globally centralized files rather than creating local project copies.
- **File Locations**:
  - **Learning Journal**: `C:\Users\LKT\.gemini\learning\learning_journal.md`
  - **Interview Talking Points**: `C:\Users\LKT\Desktop\PJs\interview_talking_points.md`
  - **Upcoming Tasks**: Use the centralized upcoming tasks file maintained by the user.
- **Trigger**: Activate this rule whenever making additions to the learning journal, tracking upcoming tasks, or recording interview talking points.
