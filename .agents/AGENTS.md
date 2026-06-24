## Local Architecture Documentation
- **Rule**: Never attempt to aggregate project-specific architecture documentation into a single global file.
- **Requirement**: For all projects, maintain a local `architecture.md` file in the project's root directory.
- **Format Content**: This file MUST contain:
  1. A clear overview of the tech stack.
  2. Integration patterns (e.g., BFF, auth flows).
  3. A 'Tradeoffs Accepted' table with columns: `Decision`, `Alternative Considered`, and `Why We Accepted This`.
- **Trigger**: Update this file whenever making significant architectural decisions or accepting notable technical tradeoffs.
