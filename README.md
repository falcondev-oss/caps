# @falcondev-oss/caps

<a href="https://npmjs.org/package/@falcondev-oss/caps" title="View this project on NPM"><img src="https://img.shields.io/npm/v/@falcondev-oss/caps.svg" alt="NPM version" /></a>

Simple **`100% type-safe`** access control library.

## Installation

```bash
npm add @falcondev-oss/caps
```

## Example

```typescript
type User = { userId: string; role: 'user' | 'moderator' | 'admin'; isBanned: boolean }
type Post = { author: User }

const useActor = createActor<User>().build((cap) => ({
  social: {
    posts: cap.subject<Post>().define(
      function* ({ actor, subject, args }) {
        // banned users can't do anything
        if (actor.isBanned || subject.author.isBanned) return []

        // everyone can read posts
        yield ['read']

        // users can update & delete posts themselves
        if (actor.userId === subject.author.userId) yield ['update', 'delete']

        // admins can delete any post & ban users
        if (actor.role === 'admin') {
          yield ['delete', 'ban']
        }

        // moderators can only delete posts from users
        if (actor.role === 'moderator' && subject.author.role === 'user') {
          yield ['delete']

          // moderators can also ban users temporarily
          if (args.ban?.temporary) yield ['ban']
        }

        return []
      },
      {
        ban: arg<{ temporary: boolean }>,
      },
    ),
  },
}))

const Users = {
  user1: { userId: '1', role: 'user', isBanned: false },
  user2: { userId: '2', role: 'user', isBanned: false },
  moderator: { userId: '3', role: 'moderator', isBanned: false },
  admin: { userId: '4', role: 'admin', isBanned: false },
} as const

const user = useActor(Users.user1)

user.social.posts.subject({ author: Users.user2 }).can('read').check() // => true
user.social.posts.subject({ author: Users.user1 }).can('update').check() // => true
user.social.posts.subject({ author: Users.user2 }).can('delete').check() // => false

const moderator = useActor(Users.moderator)

moderator.social.posts.subject({ author: Users.user1 }).can('delete').check() // => true
moderator.social.posts.subject({ author: Users.user1 }).can('update').check() // => false
moderator.social.posts.subject({ author: Users.user1 }).can('ban', { temporary: false }).check() // => false
moderator.social.posts.subject({ author: Users.user1 }).can('ban', { temporary: true }).check() // => true

const admin = useActor(Users.admin)

admin.social.posts.subject({ author: Users.user1 }).can('ban', { temporary: false }).check() // => true
```
