require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', routes);

app.listen(process.env.PORT, () => {
  console.log('Server rodando na porta ' + process.env.PORT);
});
