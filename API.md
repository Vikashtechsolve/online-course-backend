# Course Platform API

Base URL: `http://localhost:5000/api` (or `process.env.API_BASE_URL`)

All protected routes require: `Authorization: Bearer <token>`

---

## Batches

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/batches` | ✅ | List batches. Query: `search`, `isActive` |
| POST | `/batches` | admin+ | Create batch. Body: `name`, `description?`, `startDate?` |
| GET | `/batches/:id` | ✅ | Get batch by ID |
| PUT | `/batches/:id` | admin+ | Update batch |
| DELETE | `/batches/:id` | admin+ | Deactivate batch |

---

## Courses

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/courses` | ✅ | List courses. Query: `batch`, `batchId`, `search`, `teacher`, `student` |
| POST | `/courses` | admin+ | Create course. Body: `batch`, `title`, `description?` |
| GET | `/courses/:id` | ✅ | Get course with counts & teachers/students |
| PUT | `/courses/:id` | admin+ | Update course |
| POST | `/courses/:id/teachers` | admin+ | Assign teacher. Body: `teacher` (userId) |
| DELETE | `/courses/:id/teachers/:teacherId` | admin+ | Unassign teacher |
| POST | `/courses/:id/students` | admin+ | Enroll student. Body: `student` (userId) |
| DELETE | `/courses/:id/students/:studentId` | admin+ | Unenroll student |

---

## Lectures

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/lectures` | ✅ | List lectures. Query: `course`, `status` |
| POST | `/lectures` | ✅ | Create lecture (teacher of course). Body: `course`, `title`, `scheduledAt?`, `duration?`, `status?`, `meetingLink?`, `testLink?`, `practiceContent?` |
| GET | `/lectures/:id` | ✅ | Get lecture |
| PUT | `/lectures/:id` | ✅ | Update lecture |
| POST | `/lectures/:id/upload` | ✅ | Upload materials. FormData: `video`, `notesImage`, `notesPdf`, `pptSlides[]` |
| DELETE | `/lectures/:id` | ✅ | Delete lecture |
| GET | `/lectures/:id/discussions` | ✅ | List discussions |
| POST | `/lectures/:id/discussions` | ✅ | Add message. Body: `text` |

**Lecture status**: `draft`, `upcoming`, `live`, `completed`, `recorded`

---

## Assignments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/assignments` | ✅ | List assignments. Query: `course`, `student` (for student view with submission status) |
| POST | `/assignments` | ✅ | Create assignment. Body: `course`, `title`, `description?`, `dueDate`, `estimatedTime?`. Optional: `file` |
| GET | `/assignments/:id` | ✅ | Get assignment |
| PUT | `/assignments/:id` | ✅ | Update assignment. Optional: `file` |
| POST | `/assignments/:id/submit` | ✅ | Submit (student). Body: `submissionLink` |
| GET | `/assignments/:id/submissions` | ✅ | List submissions (teacher) |

---

## Submissions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| PUT | `/submissions/:id` | teacher | Grade submission. Body: `grade?`, `feedback?` |

---

## Data Models

### Batch
- `name`, `slug`, `description`, `startDate`, `isActive`

### Course
- `batch` (ref), `title`, `slug`, `description`, `order`, `isActive`

### CourseTeacher
- `course`, `teacher`, `assignedBy`

### CourseStudent
- `course`, `student`, `enrolledBy`

### Lecture
- `course`, `title`, `teacher`, `scheduledAt`, `duration`, `status`, `meetingLink`, `videoUrl`, `notes`, `ppt`, `testLink`, `practiceContent`, `order`

### Assignment
- `course`, `title`, `description`, `assignedBy`, `assignedAt`, `dueDate`, `estimatedTime`, `attachmentUrl`

### AssignmentSubmission
- `assignment`, `student`, `submissionLink`, `submittedAt`, `status`, `grade`, `feedback`

---

## Flow Summary

1. **Admin** creates batches, courses, assigns teachers, enrolls students.
2. **Teacher** creates lectures (with meeting link for live), uploads video/materials after session, creates assignments.
3. **Student** sees courses they're enrolled in, joins live sessions or views recorded content, submits assignment links, participates in discussions.
