# @falcondev-oss/caps

Simple **`100% type-safe`** access control library.

## Installation

```bash
npm add @falcondev-oss/caps
```

## Example

```typescript
const user = await getUser() // { isAdmin: false, isSupervisor: false, supervisorOfUserIds: [] }

const c = defineCapabilitiesFor(user)

const capabilities = {
  motd: c(['read']),
  project: {
    info: c(
      (actor) =>
        function* () {
          if (actor.isAdmin) yield ['write']

          return ['read']
        },
    ),
    task: c(
      (actor) =>
        function* (user: { id: string }) {
          if (actor.isAdmin) yield ['write']

          if (actor.isSupervisor && actor.superviserOfUserIds.includes(user.id)) yield ['write']

          return ['read']
        },
    ),
  },
  user: c(
    (actor) =>
      function* () {
        if (actor.isAdmin) yield ['delete']
        if (actor.isSupervisor || actor.isAdmin) yield ['write']

        return ['read']
      },
  ),
}

// check if user can read the message of the day
capabilities.motd.can('read').check() // => true

// check if user can write task
capabilities.project.task.can('write', { id: 'user1' }).check() // => false
```
