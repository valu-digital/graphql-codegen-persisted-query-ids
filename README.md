# Generate Persisted Query IDs

A plugin for graphql-code-generator

## Install

Install graphql-code-generator and this plugin

    npm i -D graphql-code-generator graphql-codegen-persisted-query-ids

## Usage

Create codegen.yml

```yaml
schema: http://app.test/graphql
documents: "./src/**/*.js"
generates:
    persisted-query-ids/client.json:
        - graphql-codegen-persisted-query-ids:
              output: client

    persisted-query-ids/server.json:
        - graphql-codegen-persisted-query-ids:
              output: server
```

Run the generator

    mkdir persisted-query-ids
    ./node_modules/.bin/gql-gen --overwrite

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

Add my fork of the wp-graphql-persisted-queries plugin

    cd wp-content/plugins
    git clone https://github.com/epeli/wp-graphql-persisted-queries

> The fork is required for now but I've sent the changes as PRs to the upstream

In your theme's `functions.php` add

```php
add_filter( 'graphql_persisted_queries_load_query', function( $queries, string $query_id ) {
    $queries = json_decode( file_get_contents( __DIR__ . '/../persisted-query-ids/server.json' ), true );
    return $queries[ $query_id ] ?? null;
}, 10, 2 );

```

Pro tip: You can enable the [lock mode][lock] using this.

[lock]: https://github.com/epeli/wp-graphql-persisted-queries#lock-mode

### Integrating with Apollo Client

Add custom `generateHash` to [apollo-link-persisted-queries](https://github.com/apollographql/apollo-link-persisted-queries)

```ts
import { createPersistedQueryLink } from "apollo-link-persisted-queries";
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
