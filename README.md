# minipass-pipeline

Create a pipeline of streams using Minipass.

Calls `.pipe()` on all the streams in the list.  Returns a stream where
writes got to the first pipe in the chain, and reads are from the last.

Errors are proxied along the chain and emitted on the Pipeline stream.

## USAGE

```js
const Pipeline = require('minipass-pipeline')

// the list of streams to pipeline together,
// a bit like `input | transform | output` in bash
const p = new Pipeline(input, transform, output)

p.write('foo') // writes to input
p.on('data', chunk => doSomething()) // reads from output stream

// less contrived example (but still pretty contrived)...
const decode = new bunzipDecoder()
const unpack = tar.extract({ cwd: 'target-dir' })
const tbz = new Pipeline(decode, unpack)

fs.createReadStream('archive.tbz').pipe(tbz)

// specify any minipass options if you like, as the first argument
// it'll only try to pipeline event emitters with a .pipe() method
const p = new Pipeline({ objectMode: true }, input, transform, output)
```

Pipeline is a [minipass](http://npm.im/minipass) stream, so it's as
synchronous as the streams it wraps.  It will buffer data until there is a
reader, but no longer, so make sure to attach your listeners before you
pipe it somewhere else.
