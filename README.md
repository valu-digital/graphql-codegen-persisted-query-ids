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
