import { DocumentNode, parse } from "graphql";
import {
    generateQueryIds,
    findUsedFragments,
    findFragments,
    plugin,
    PluginConfig,
} from "../src";
import { Types } from "@graphql-codegen/plugin-helpers";

const SCHEMA = {} as any;

// Nooop gql fn for prettier
function gql(...things: TemplateStringsArray[]) {
    return things.join("");
}

function runPlugin(docs: DocumentNode[], config: PluginConfig): any {
    const documents: Types.DocumentFile[] = docs.map((doc) => ({
        filePath: "",
        document: doc,
    }));
    return JSON.parse(plugin(SCHEMA, documents, config) as string);
}

describe("can generate query for simple doc", () => {
    const doc = parse(gql`
        query Foo {
            bar
        }
    `);

    test("client", async () => {
        const client: any = runPlugin([doc], {
            output: "client",
        });

        expect(client["Foo"]).toBeTruthy();
    });

    test("query ids match from client to server", () => {
        const client = runPlugin([doc], {
            output: "client",
        });

        const server = runPlugin([doc], {
            output: "server",
        });

        const query = server[client["Foo"]];
        expect(query).toBeTruthy();
        expect(query).toMatchSnapshot();
    });

    describe("fragments", () => {
        const doc1 = parse(gql`
            fragment myFragment on Ding {
                name
            }

            query Foo {
                bar
                ...myFragment
            }
        `);

        const doc2 = parse(gql`
            query Foo2 {
                bar
            }
        `);

        const multiQueryDoc = parse(gql`
            fragment myFragment on Ding {
                name
            }

            query Foo {
                bar
                ...myFragment
            }

            query Foo2 {
                bar
            }
        `);

        test("is added to queries", () => {
            const server = runPlugin([doc1, doc2], {
                output: "server",
            });

            const client = runPlugin([doc1, doc2], {
                output: "client",
            });

            expect(server[client["Foo"]]).toContain("fragment myFragment");
        });

        test("multiple docs not using fragments", () => {
            const server = runPlugin([doc1, doc2], {
                output: "server",
            });

            const client = runPlugin([doc1, doc2], {
                output: "client",
            });

            expect(server[client["Foo2"]]).not.toContain("fragment myFragment");
        });

        test("multi query doc", () => {
            const server = runPlugin([multiQueryDoc], {
                output: "server",
            });

            const client = runPlugin([multiQueryDoc], {
                output: "client",
            });

            expect(server[client["Foo"]]).toContain("fragment myFragment");
            expect(server[client["Foo2"]]).not.toContain("fragment myFragment");
        });

        test("can use fragment before it's definition", () => {
            const doc = parse(gql`
                query Foo {
                    bar
                    ...myFragment
                }

                fragment myFragment on Ding {
                    name
                }
            `);

            const server = runPlugin([doc], {
                output: "server",
            });

            const client = runPlugin([doc], {
                output: "client",
            });

            const query = server[client["Foo"]];
            expect(query).toBeTruthy();
        });

        test("fragments in fragments work", () => {
            const fragInFrag = parse(gql`
                fragment nestedFrag on Ding {
                    fromNested
                }

                fragment myFragment on Ding {
                    name
                    ...nestedFrag
                }

                query Foo {
                    bar
                    ...myFragment
                }
            `);

            const server = runPlugin([fragInFrag], {
                output: "server",
            });

            const client = runPlugin([fragInFrag], {
                output: "client",
            });

            const query = server[client["Foo"]];
            expect(query).toBeTruthy();
            expect(query).toContain("fragment nestedFrag");
            expect(query).toContain("fragment myFragment");
        });
    });

    describe("mutation", () => {
        const doc = parse(gql`
            mutation AddTodo($title: String!) {
                createTodo(
                    input: {
                        title: $title
                        clientMutationId: "lala"
                        completed: false
                        status: PUBLISH
                    }
                ) {
                    clientMutationId
                    todo {
                        id
                        title
                        completed
                    }
                }
            }
        `);

        test("query ids match from client to server", () => {
            const client = runPlugin([doc], {
                output: "client",
            });

            const server = runPlugin([doc], {
                output: "server",
            });

            const query = server[client["AddTodo"]];
            expect(query).toBeTruthy();
        });
    });

    test("can find nested fragment user", () => {
        const doc = parse(gql`
            fragment TodoParts on Todo {
                title
            }

            query DualTodoList($cursorTodos: String!, $cursorDones: String!) {
                todos(
                    first: 3
                    after: $cursorTodos
                    where: { completed: false }
                ) {
                    ...TodoParts
                }
                dones: todos(
                    first: 3
                    after: $cursorDones
                    where: { completed: true }
                ) {
                    ...TodoParts
                }
            }
        `);

        const operation = doc.definitions.find(
            (def) => def.kind === "OperationDefinition",
        );

        if (!operation || operation.kind !== "OperationDefinition") {
            throw new Error("cannot find operation");
        }

        const knownFragments = findFragments([doc]);

        const fragmentNames = Array.from(
            findUsedFragments(operation, knownFragments).values(),
        ).map((frag) => frag.name.value);

        expect(fragmentNames).toEqual(["TodoParts"]);
    });
});

describe("can extract variable info", () => {
    const doc1 = parse(gql`
        query Foo {
            bar
        }
    `);

    const doc2 = parse(gql`
        query Foo($foo: String) {
            bar
        }
    `);

    test("does not use variables", async () => {
        const client = generateQueryIds([doc1], { output: "client" });

        expect(client["Foo"]).toMatchObject({
            hash: expect.stringMatching(/.+/),
            query: expect.stringContaining("query Foo"),
            usesVariables: false,
        });
    });

    test("does use variables", async () => {
        const client = generateQueryIds([doc2], { output: "client" });

        expect(client["Foo"]).toMatchObject({
            hash: expect.stringMatching(/.+/),
            query: expect.stringContaining("query Foo"),
            usesVariables: true,
        });
    });
});
