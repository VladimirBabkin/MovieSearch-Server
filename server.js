

import http from "node:http"
import EventEmitter from "node:events"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const PORT = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backupFilePath = process.env.BACKUP_FILE_PATH || "db_backup.txt";

const users = [
    {id: 1, name: 'Vovan supa'},
    {id: 2, name: 'den'}
]

const IMAGES_DIR = path.join(__dirname, 'images');



class Application{
    constructor() {
        this.emitter = new EventEmitter();
        this.server = this._createServer();
        this.middlewares = []
    }

    use(middleware){
        this.middlewares.push(middleware);
    }

    listen(port, callback){
        this.server.listen(port, callback)
    }

    addRouter(router) {
        Object.keys(router.endpoints).forEach(path => {
            const endpoint = router.endpoints[path];
            Object.keys(endpoint).forEach((method) => {
                //console.log("router",router.endpoints )
                this.emitter.on(this._getRouteMask(path, method), (req, res) => {
                    const handler = endpoint[method];
                    if (path !='/static/images' ) {
                        res.writeHead(200, {
                            'Content-Type': 'application/json'
                        })
                    }
                    handler(req, res)
                })
            })
            //console.log(router)
        })
    }



    _createServer() {
        return http.createServer((req, res) => {
            let body = "";

            req.on('data', (chunk) => {
                body += chunk;
            })

            req.on('end', () => {
                if(body) {
                    //console.log('body',typeof body)
                    req.body = JSON.parse(body);
                    // console.log('afterJSON',typeof req.body)
                }
                this.middlewares.forEach(middleware => middleware(req, res));
                //console.log('req.pathname',req.pathname, 'req.method',req.method)
                
                const emitted = this.emitter.emit(this._getRouteMask(req.pathname, req.method), req, res)
            if (!emitted) {
                //console.log('status',res.statusCode )
                //console.log('req.param',req.param )
                res.statusCode = 404;
                res.end('404 Not Found')
            }
            })

            
        })
    }

    _getRouteMask(path, method) {
        return `[${path}]:[${method}]`;
    }
}







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







if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR);
}



async function readJsonLines(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
        let buffer = '';

        stream.on('data', (chunk) => {
            buffer += chunk;
            let boundary = buffer.indexOf('\n');

            while (boundary !== -1) {
                const line = buffer.substring(0, boundary).trim();
                if (line) {
                    try {
                        const json = JSON.parse(line);
                        results.push(json);
                        saveImage(json);
                    } catch (err) {
                        reject(new Error(`Ошибка при разборе строки JSON: ${err.message}`));
                    }
                }
                buffer = buffer.substring(boundary + 1);
                boundary = buffer.indexOf('\n');
            }
        });

        stream.on('end', () => {
            if (buffer) {
                try {
                    const json = JSON.parse(buffer);
                    results.push(json);
                    saveImage(json);
                } catch (err) {
                    reject(new Error(`Ошибка при разборе последней строки JSON: ${err.message}`));
                }
            }
            resolve(results);
        });

        stream.on('error', (err) => {
            reject(new Error(`Ошибка при чтении файла: ${err.message}`));
        });
    });
}

function saveImage(movie) {
    const { id, img } = movie;
    if (id && img) {
        const imgPath = path.join(IMAGES_DIR, `${id}.jpeg`);
        const imgData = img.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(imgData, 'base64');

        fs.writeFileSync(imgPath, buffer, (err) => {
            if (err) {
                console.error(`Ошибка при сохранении изображения для фильма ${id}:`, err);
            }
        });
    }
}



if (!backupFilePath) {
    console.error('Не задан путь к файлу бэкапа в переменной окружения BACKUP_FILE_PATH');
    process.exit(1);
}

// Приведение пути к абсолютному
const absolutePath = path.resolve(backupFilePath);






const movies = await readJsonLines(absolutePath);
const moviesCards = movies.map(movie => {
    return    {
        id: String(movie.id),
        title: movie.title,
        description: movie.description,
        genre: movie.genre,
        release_year: Number(movie.release_year),
    }
})


const getMovieCardById = (req, res) => {
    const movieId = req.params.id;
    //console.log('movieId', movieId)

    const moviesCard = moviesCards.find(card => {
        //console.log(card.id)
        return card.id == movieId
    });
   // console.log('movie', moviesCard, ' typeof movie', (typeof moviesCard))


    // {
    //     id: movie.id,
    //     title: movie.title,
    //     description: movie.description,
    //     genre: movie.genre,
    //     release_year: movie.release_year,
    // }

    if (moviesCard) {
       // console.log('json',JSON.stringify(moviesCard))
        res.send(moviesCard);
    } else {
        res.statusCode = 404;
        res.end('Movie not found');
    }
}

const getMovieCardsArr = (req, res) => {

    function chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }
    const page = req.params.page;
    let index = 0;
    if (page != undefined) {
        index = page - 1
    }
    if (page < -1) {
        index = 0
    }
    let moviesCards10Each = []
    if (req.params.title) {
        const title = req.params.title.toLowerCase();
        const cardsArr = moviesCards.filter(movieCard => {
            return movieCard.title.toLowerCase().includes(title)
        })
         moviesCards10Each = chunkArray(cardsArr, 10)
        
        if (index > moviesCards10Each.length ) {
            res.statusCode = 404;
            res.send({
                search_result: []
            });
            return
        }
            
        
    } else {
         moviesCards10Each = chunkArray(moviesCards, 10)
        if (index > moviesCards10Each.length ) {
            res.statusCode = 404;
            res.send({
                search_result: []
            });
            return
        }
        }
        let answer = {};
        if (moviesCards10Each[index] == undefined) {
            answer = {
                search_result: []
            }
        } else { 
            answer =  {
                search_result: moviesCards10Each[index]
            }
        }
        
        res.send(answer)
    }


const getMovieImg = (req, res) => {
    const { id } = req.params;
    if (id) {
        const imgPath = path.join(__dirname,  'images', `${id}.jpeg`);
        if (fs.existsSync(imgPath)) {
            res.writeHead(200, { 'Content-Type': 'image/jpeg' });
            fs.createReadStream(imgPath).pipe(res);
        } else {
            res.statusCode = 404;
            res.send({ error: 'Image not found' });
        }
    } else {
        res.statusCode = 400;
        res.send({ error: 'Missing id parameter' });
    }
};



const getUsers = (req, res) => {
        if (req.params.id) {
            return res.send(users.find(user => user.id == req.params.id))
        }
        res.send(users)
    }


const postUsers =  (req, res) => {
    const user = req.body;
    users.push(user)
    res.send(users)
}


const router = new Router();

router.get('/ping',  ((req, res) => res.send({ message: 'pong' })))

router.post('/echo', ((req, res) =>  res.send(req.body)));

router.get('/users',  getUsers)

router.post('/users', postUsers)

router.get('/api/v1/movie', getMovieCardById)

router.get('/api/v1/search', getMovieCardsArr)

router.get('/static/images', getMovieImg)



function parseJson (req, res)  {
    
    res.send = data => {
        res.end(JSON.stringify(data))
    }
}

function parseUrl(req, res) {
    const protocol = req.headers['x-forwarded-proto'] || (req.connection.encrypted ? 'https' : 'http');
    const host = req.headers.host;
    // console.log('host^', host, protocol)
    const baseUrl = `${protocol}://${host}`;
    const parsedUrl = new URL(req.url, baseUrl)
    
    if(parsedUrl.pathname.startsWith("/api/v1/movie")) {
        const regex = /^\/api\/v1\/movie\/(\d+)$/;
        const match = parsedUrl.pathname.match(regex);
        if (match) {
            req.params = { id: match[1] };
            
            req.pathname = "/api/v1/movie"
            //console.log('req.pathname',req.pathname)
        } else {
            req.params = {};
        }
        return
    }
    if(parsedUrl.pathname.startsWith("/static/images")) {
        const regex = /\/static\/images\/(\d+)\.jpeg/;
        const match = parsedUrl.pathname.match(regex);
        if (match) {
            req.params = { id: match[1] };
            
            req.pathname = "/static/images"
            //console.log('req.pathname',req.pathname)
        } else {
            req.params = {};
        }
        return
    }
   
    req.pathname = parsedUrl.pathname
    const params = {};
    parsedUrl.searchParams.forEach((value, key) => params[key] = value)
    req.params = params;    
}










  
const app = new Application();



app.use(parseJson)
app.use(parseUrl);
app.addRouter(router);

app.listen(PORT, () => console.log(`server started on PORT ${PORT}`))


