import { main } from './snapshot';

// vite-node drops the script path, so argv[2..] are the arguments.
main(process.argv.slice(2));
