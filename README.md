# Generate Persisted Query IDs

A plugin for graphql-code-generator

Install graphql-code-generator and this plugin

    npm i -D graphql-code-generator graphql-codegen-persisted-query-ids

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
