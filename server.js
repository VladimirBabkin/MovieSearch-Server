const PORT = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backupFilePath = process.env.BACKUP_FILE_PATH || "db_backup.txt";



import http from "node:http"
import EventEmitter from "node:events"



const server = http.createServer((req, res) => {
    res.writeHead(200, {
        'Content-type': 'text/html'
    })
    res.end('<h1>HEllo</h1>')
})


class Router {
    constructor() {
        this.endpoints = {}
    }

    request(method = 'GET', path, handler) {
        if(!this.endpoints[path]) {
            this.endpoints[path] = {}
        }

        const endpoint = this.endpoints[path];

        if(endpoint[method]) {
            throw new Error(`[${method}] по адресу ${path} уже существует`)
        }

        endpoint[method] = handler;
        // emitter.on(`[${path}]:[${method}]`, (req, res) => {
        //     handler(req, res)
        // })
    }

    get(path, handler) {
        this.request('GET', path, handler);
    }

    post(path, handler) {
        this.request('POST', path, handler);
    }

    put(path, handler) {
        this.request('PUT', path, handler);
    }

    delete(path, handler) {
        this.request('DELETE', path, handler);
    }
}