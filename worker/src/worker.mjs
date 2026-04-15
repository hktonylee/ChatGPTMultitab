import indexHtml from "../../index.html";
import faviconSvg from "../../favicon-inverted.svg";
import { createWorker } from "./worker-response.mjs";

export default createWorker(indexHtml, { faviconSvg });
