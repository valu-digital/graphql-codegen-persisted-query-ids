# Generate Persisted Query IDs

A plugin for graphql-code-generator

## Install

Install graphql-code-generator and this plugin

    npm i -D graphql @graphql-codegen/cli graphql-codegen-persisted-query-ids

## Usage

Create codegen.yml

```yaml
schema: http://localhost:5000/graphql
documents: "./src/**/*.ts"
generates:
    persisted-query-ids/client.json:
        - graphql-codegen-persisted-query-ids:
              output: client
              algorithm: sha256

    persisted-query-ids/server.json:
        - graphql-codegen-persisted-query-ids:
              output: server
              algorithm: sha256
```

Run the generator

    mkdir persisted-query-ids
    npx graphql-codegen

This will generate two json files. The `server.json` is a query id mapping to
the actual queries which should be consumed by the server.

Example

```json
{
    "093eb2253f63de7afc7c4637bf19273a09591c2139bc068de320ae78e39755d9": "query Thing { field }"
}
```

The `client.json` file is an operation name mapping to the query id to be
consumed by the GraphQL clients.

```json
{
    "Thing": "093eb2253f63de7afc7c4637bf19273a09591c2139bc068de320ae78e39755d9"
}
```

### Integrating with WPGraphQL

Use the [wp-graphql-lock][] plugin

    cd wp-content/plugins
    git clone https://github.com/valu-digital/wp-graphql-lock

[wp-graphql-lock]: https://github.com/valu-digital/wp-graphql-lock

In your theme's `functions.php` add

```php
add_filter( 'graphql_lock_load_query', function( string $query, string $query_id ) {
    $queries = json_decode( file_get_contents( __DIR__ . '/../persisted-query-ids/server.json' ), true );
    return $queries[ $query_id ] ?? null;
}, 10, 2 );

```

### Integrating with Apollo Client

Add custom `generateHash` to [apollo-link-persisted-queries](https://github.com/apollographql/apollo-link-persisted-queries)

```ts
import { createPersistedQueryLink } from "@apollo/client/link/persisted-queries";
// import {createPersistedQueryLink } from "apollo-link-persisted-queries"; // For Apollo Client v2
import { usePregeneratedHashes } from "graphql-codegen-persisted-query-ids/lib/apollo";

const hashes = require("../persisted-query-ids/client.json");

const persistedLink = createPersistedQueryLink({
    useGETForHashedQueries: true, // Optional but allows better caching
    generateHash: usePregeneratedHashes(hashes),
});

// And pass it to ApolloClient

const client = new ApolloClient({
    link: persistedLink.concat(createHttpLink({ uri: "/graphql" })),
    cache: new InMemoryCache(),
});
```
