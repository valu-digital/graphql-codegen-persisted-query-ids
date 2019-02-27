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
              addTypeName: true # required when using apollo-client
```

Run the generator

    mkdir persisted-query-ids
    ./node_modules/.bin/gql-gen --overwrite

Commit these files to git.

### Integrating with WPGraphQL

Add my fork of the wp-graphql-persisted-queries plugin

    cd wp-content/plugins
    git clone https://github.com/epeli/wp-graphql-persisted-queries

> The fork is required for now but I've sent the changes as PRs to the upstream

In your theme's `functions.php` add

```php
add_filter( 'graphql_persisted_queries_load_query', function( string $query_id ) {
    $queries = json_decode( file_get_contents( __DIR__ . '/persisted-query-ids/server.json' ), true );
    return $queries[ $query_id ] ?? null;
}, 10, 1 );
```

You can progmatically manage the lock mode with the option filter

```php
add_filter( 'option_graphql_persisted_queries_is_locked', function() {
    return defined( 'WP_ENV' ) && 'production' ===  WP_ENV;
}, 10 , 1 );
```

### Integrating with Apollo Client

Add custom `generateHash` to [apollo-link-persisted-queries](https://github.com/apollographql/apollo-link-persisted-queries)

```ts
import { createPersistedQueryLink } from "apollo-link-persisted-queries";
import { usePregeneratedHashed } from "graphql-codegen-persisted-query-ids/lib/apollo";

const hashes = require("../persisted-query-ids/client");

const persistedLink = createPersistedQueryLink({
    useGETForHashedQueries: true, // Optional but allows better caching
    generateHash: usePregeneratedHashed(hashes),
});

// And pass it to ApolloClient

const client = new ApolloClient({
    link: persistedLink.concat(createHttpLink({ uri: "/graphql" })),
    cache: new InMemoryCache(),
});
```
