# Flazy API

The first progressive self-coding API server. A truly flashy way to create a backend API system, though it feels a bit like lazy coding

## What am I doing?

I've seen so many AI-based software builders. They all start the same way: by creating a specification, even a PRD (Product Requirements Document), and then implementing the actual code. It takes a really long time to build, run, and test. Why not just create the blueprint, run the boilerplate, then implement it and test the features one by one while running the program? Is that technically possible?

Flazy is a framework for that dream. It prepares everything from specification/blueprint, code-generation, database, and API router, to self-coding, self-fixing, and testing - all progressively. At first, it only creates the blueprint, and the actual code is generated while the program is running.

## Install

```
npm install -g @naiv/flazy-api
```

`flazy-api` must be installed globally since user project depends on Flazy `node-modules`

## Usage

Before running the cli, you must expose your Open Router API Key on your terminal environment

```bash
export SK=sk-or-v1-42e4ca6....
```

Verify
```bash
echo $SK
sk-or-v1-42e4ca6....  # output
```

### 1. Prepare Model Data & API Specification

```bash
$ mkdir my-api        # create new project directory
$ cd my-api           # enter directory
$ flazy-api --chat    # begin requirements generation
```

Output

```
? Explain briefly your API program ‣ buatkan program backend untuk pos kasir
✔ Generating data & API specification
```

After completing this step, you will have a file called `api-specification.naiv` inside your `my-api` folder. This file contains the DSL for your data model and API specification for your backend API.

### 2. Create Empty Database

In this example I use NAIV Zero Services to create an empty database, you can use your own database read below how to do it.

- Open https://naiv.dev/zero, login/register your account
- Go to Database tab
- Add new database
- Copy dbkey 64-character string long, something like this: e4e4eed9a....

### 3. Run Program

```bash
$ flazy-api --run --dbkey <your-dbkey>
```

Output
```
DB Key Accepted!
db initialized
⚠️ implementation for api 'get /api1' not found, skip.
⚠️ implementation for api 'post /api2' not found, skip.
⚠️ implementation for api 'post /api3' not found, skip.
...
completed.

⚡️[server]: Server is running at http://localhost:9000
```

**Congrats your API progam is now running!**

## For Real?

Just kidding... kind of! your API project is running, but the implementation is still empty. Your API will implement itself the first time you call it.
You might notice a slightly longer response time on the first call, because it’s running a LLM-conversation to generate the API functions.

## Full CLI Available Command Example

#### Build NAIV Specification

```bash
flazy-api --chat
```

#### Run API
```bash
# run api on current folder port 9000
flazy-api --dbkey a83cd12.. --run .

# run api on current folder port 9000
flazy-api --dbkey a83cd12.. --run

# run api on folder my-api port 9000
flazy-api --dbkey a83cd12.. --run my-api

# run api on current folder port 8080
flazy-api --dbkey a83cd12.. --run --port 8080

# run api on current folder port 8080 with OpenRouter model z-ai/glm-5
flazy-api --dbkey a83cd12.. --run --port 8080 --model z-ai/glm-5

# run api on current folder port 9000 with 
# dbkey provided by API 'http://localhost:3000'
flazy-api --dburl 'http://localhost:3000' --dbkey a83cd12.. --run
```

## Custom DB Provider

Look at this code from `exec.ts` on this project, this is how Flazy fetch translate database key into database credentials:

```ts
axios.get(dburl ?? 'https://api-x.naiv.dev/db-credential', { headers: { uniqid: database_key } })
```

You must provide an API that handle `GET /db-credential` with headers `uniqid: string required`. Expected response type:

```ts
export interface DBCredential {
  db_type: string
  db_host: string
  db_name: string
  db_username: string
  db_password: string
  db_port: number
}
```

## Limitation

- LLM provider on this prototype right now only support openrouter.ai, will add more other LLM provider soon. LLM model can be change via `--model <model-slug>` argument.
- Users project really depends on flazy-api dependency, it makes your project almost not supporting any third-party library except flazy-api dependency (bcrypt, jsonwebtoken, etc).
- Self-healing feature is not implemented yet, in theory this program should be able to fix itself when a 5xx error (server side error) occured, I still think how to handle it efficiently in real solution.
- Unsupported direct `npx` command, since `npx` binary program doesnt have its own `node-modules` exposed.
- There are still many limitations, as this project is still new. We really appreciate any helpful feedback!