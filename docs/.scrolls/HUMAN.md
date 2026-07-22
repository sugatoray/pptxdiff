# Notes for the Human User

Installing the `devDependencies` from the `package.json` file:

```bash
npm install --include=dev
```

To use the `package-lock.json` file with `devDependencies`:

```bash
NODE_ENV=development npm install
```
