import {expect} from "chai";
import WebSocket from "../polyfill/WebSocket";
import {expectEventually, rnd, sleep, supervisor, TIMEOUT_FACTOR} from "../wrench.spec";
import {Pipe} from "./Pipe";

describe("Pipe", () => {
    let ws: WebSocket;
    let testCase: string;

    before(async () => {
        await expectEventually(() => supervisor.ws.readyState === WebSocket.OPEN,
            "The supervisor failed to connect");
    });
    beforeEach((done) => {
        testCase = rnd();
        ws = new WebSocket(`ws://localtest.me:4752/${testCase}`);
        ws.onopen = () => done();
    });

    afterEach(async () => {
        if (ws) {
            ws.close();
        }
    });

    describe("constructor", () => {
        it("should throw an error if the channel parameter is invalid", () => {
            ["", 6, NaN, [], {}, "XXXXX"].forEach((channel) => {
                expect(() => new Pipe(ws, channel as any)).to.throw();
            });
        });
        it("should support a prefix length", () => {
            ["a", "aaaaaaaaaa"].forEach((channel) => {
                expect(() => new Pipe(ws, channel as any, 10)).to.not.throw();
            });
            ["aaaaaaaaaaa"].forEach((channel) => {
                expect(() => new Pipe(ws, channel as any, 10)).to.throw();
            });
        });
    });

    describe("close", () => {
        it("should dispatch a close event", (done) => {
            const mp = new Pipe(ws, "a");
            mp.addEventListener("close", () => {
                done();
            });
            mp.close();

        });

        it("should dispatch a single close event if closed twice", (done) => {
            const mp = new Pipe(ws, "a");
            let events = 0;
            mp.addEventListener("close", () => {
                events ++;
            });
            mp.close();
            mp.close();
            setTimeout(() => {
                expect(events).to.equal(1);
                done();
            }, 5);

        });
        it("should stop listening to the message", async () => {
            const mp = new Pipe(ws, "a");
            let received = false;
            mp.addEventListener("message", (e: MessageEvent) => {
                received = true;
            });
            mp.close();

            ws.send("   aping");
            await sleep(TIMEOUT_FACTOR * 100);
            return expect(received).to.be.false;
        });
        it("should not throw an error on send", async () => {
            const mp = new Pipe(ws, "a");
            mp.close();
            expect(() => mp.send("")).to.not.throw();
            await sleep(TIMEOUT_FACTOR * 50);
            const logs = await supervisor.logs(testCase);
            expect(logs.map((l) => l[1])).to.deep.equal(["connect"]);
        });
        it("should have a correct readyState", async () => {
            const mp = new Pipe(ws, "a");
            expect(mp.readyState).to.equal(mp.OPEN);
            mp.close();
            expect(mp.readyState).to.equal(mp.CLOSING);
            await sleep(TIMEOUT_FACTOR * 1);
            expect(mp.readyState).to.equal(mp.CLOSED);
        });
    });

    describe("send", () => {
        it("should prefix messages with the channel", async () => {
            const mp = new Pipe(ws, "a");
            mp.send("data");
            await sleep(TIMEOUT_FACTOR * 50);
            const logs = await supervisor.logs(testCase);
            expect(logs.map((l) => l[1])).to.deep.equal(["connect", "   adata"]);
        });
        it("should refuse a non string message", async () => {
            const mp = new Pipe(ws, "a");
            [6, NaN, [], {}].forEach((message) => {
                expect(() => mp.send(message as any)).to.throw();
            });
        });
    });

    describe("receive", () => {
        it("filter the messages", async () => {
            const mpA = new Pipe(ws, "a");
            const mpB = new Pipe(ws, "b");
            const messagesA = [];
            const messagesB = [];
            mpA.addEventListener("message", (e: MessageEvent) => {
                expect(e.data).to.equal("pong");
                messagesA.push(e.data);
            });
            mpB.addEventListener("message", (e: MessageEvent) => {
                expect(e.data).to.equal("pong");
                messagesB.push(e.data);
            });

            mpA.send("ping");
            mpB.send("ping");
            mpB.send("ping");

            await sleep(2000);
            expect(messagesA.length).to.equal(1);
            expect(messagesB.length).to.equal(2);

        });
    });
});
