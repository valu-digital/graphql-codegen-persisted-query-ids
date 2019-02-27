import { parse } from "graphql";
import { generateQueryIds } from "../src";

// Nooop gql fn for prettier
function gql(...things: TemplateStringsArray[]) {
    return things.join("");
}

describe("can generate query for simple doc", () => {
    const doc = parse(gql`
        query Foo {
            bar
        }
    `);

    test("client", () => {
        const client = generateQueryIds([doc], {
            output: "client",
        });

        expect(client).toEqual({
            Foo:
                "5430c050ffd840248a6724bb3a674ffb347dce047429ba5bf61a9edee3d8d699",
        });
    });

    test("server", () => {
        const server = generateQueryIds([doc], {
            output: "server",
        });

        expect(server).toMatchSnapshot();
    });

    test("query ids match from client to server", () => {
        const client = generateQueryIds([doc], {
            output: "client",
        });

        const server = generateQueryIds([doc], {
            output: "server",
        });

        const query = server[client["Foo"]];
        expect(query).toBeTruthy();
        expect(query).toMatchSnapshot();
    });
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

    test("is added to queries", () => {
        const server = generateQueryIds([doc1, doc2], {
            output: "server",
        });

        const client = generateQueryIds([doc1, doc2], {
            output: "client",
        });

        expect(server[client["Foo"]]).toContain("myFragment");
    });

    test("multiple docs not using fragments", () => {
        const server = generateQueryIds([doc1, doc2], {
            output: "server",
        });

        const client = generateQueryIds([doc1, doc2], {
            output: "client",
        });

        expect(server[client["Foo2"]]).not.toContain("myFragment");
    });
});
