## INSTRUCTION

### 1. Database Design

No comments on design files `//` or `/** */`.

#### Table

```naiv
table User {
    id bigint pk inc notnull
    name varchar(255) notnull
    email varchar(255) unique notnull
    password varchar(255) notnull
    created_at timestamp notnull default=NOW()
    updated_at timestamp notnull default=NOW()
}
```

- `inc` means auto increment.
- `notnull` means not null.
- `pk` means primary key.
- `unique` means unique.
- `default` means default value. `NOW()` is a function that returns current timestamp. If default value is string then write it with quote like `default="value"`. If number write it without quote like `default=123`.


#### Relationship

```naiv
table User {
    id bigint pk inc notnull
    name varchar(255) notnull
    email varchar(255) unique notnull
    password varchar(255) notnull
    created_at timestamp notnull default=NOW()
    updated_at timestamp notnull default=NOW()
}

table Product {
    id bigint pk inc notnull
    id_user_owner User.id notnull
    name varchar(255) notnull
    price decimal(10,2) notnull
    created_at timestamp notnull default=NOW()
    updated_at timestamp notnull default=NOW()
}
```

`User` has link to `Product` by `id_user_owner`.

#### Enum

```naiv
enum ProductStatus {
    DRAFT
    PUBLISHED
    ARCHIVED
}

table Product {
    id bigint pk inc notnull
    id_user_owner User.id notnull
    name varchar(255) notnull
    price decimal(10,2) notnull
    status enum.ProductStatus notnull default=DRAFT
    created_at timestamp notnull default=NOW()
    updated_at timestamp notnull default=NOW()
}
```

default value for enum is written without quote like `default=DRAFT`.

### 2. API Design

API design in NAIV accept only method GET, POST, PUT, DELETE, PATCH. Each API must have unique alias, alias will be used as function call in http client which consume this api design. No comments on design files `//` or `/** */`. Here is how to write it:

#### GET

```naiv
api get /users {
    alias getUsers
    return array table.User required
}
```

simple api design for get all users. `required` means this api will response list of users. If not required means this api will response either list users or null. `array` means this api will response array of users. `table.User` means this api will response table structure of User entity on database design above.

Other possibility return type beside table reference are native types: `string`, `boolean`, `number`, and schema inline and schema reference (schema will be explained later).

```naiv
api get /users/:id {
    alias getUserById
    path {
        id number required
    }
    return table.User required
}
```

simple api design for get user by id. no `array` means this api will response single user. `path` means this api will accept path parameter, path parameter must be required if it has path parameter on the url. path parameter only accept native types: `string`, `number`, and `boolean`.

```naiv
api get /users {
    alias getUsers
    query {
        name string
        limit number required
        offset number required
    }
    return array table.User required
}
```

simple api design for get users by name. `query` means this api will accept query parameter, query parameter must be optional if it has query parameter on the url. `required` on query `limit` and `offset` means this api will accept query parameter `limit` and `offset` and it must be required. `name` on query is optional. query parameter only accept native types: `string`, `number`, and `boolean`.

```naiv
api get /profile {
    alias getProfile
    headers {
        authorization string required
    }
    return table.User required
}
```

simple api design for get profile. `headers` means this api will accept headers parameter, headers parameter must be required if it has headers parameter on the url. headers parameter only accept native types: `string`, `number`, and `boolean`.

#### DELETE

same like GET, DELETE also accept path, query, and headers parameter.

#### POST

```naiv
api post /users {
    alias createUser
    body {
        name string required
        email string required
        password string required
    }
    return table.User required
}
```

simple api design for create user. `body` means this api will accept body parameter, body parameter must be required if it has body parameter on the url. body parameter accept native types: `string`, `number`, `boolean`, and schema inline and schema reference (schema will be explained later).

```naiv
api post /sample-complex-post {
    alias sampleComplexPost
    body {
        foo {
            bar string required
            baz number required
        } required
        qux string required
    }
    return string required
}
```

foo has type schema inline, it means foo is a schema that defined inside api design like inline object type in typescript.

```naiv
schema LoginRequest {
    email string required
    password string required
}
api post /login {
    alias login
    body {
        data schema.LoginRequest required
    }
    return {
        token string required
        user table.User required
    } required
}
```

`data` has type schema reference `LoginRequest`, it means `data` is a schema that defined outside api design. Both schema reference and schema inline also supported for return type. If you want to have an array inside schema inline, you can use `array` keyword.

```naiv
schema Foo {
    bar array string required
    tuz string required
}
schema Buzz {
    foo schema.Foo required
}
api post /sample-complex-post-2 {
    alias sampleComplexPost2
    body {
        foo schema.Foo required
        buzz array schema.Buzz required
    }
    return string required
}
```

object inside array also supported on body and also return type.

#### PATCH, PUT

same like POST, PATCH and PUT also accept path, query, body, and headers parameter.

#### Streaming response

NAIV api design also support streaming response. Here is how to write it:

```naiv
api get /chat {
    alias promptChat
    query {
        prompt string required
    }
    return stream of string required
}
```

`stream of` keyword means this api will return stream of data. `stream of` accept native types: `string`, `number`, `boolean`, schema (inline or reference), and table reference.
