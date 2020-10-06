import { app, errorHandler } from 'mu';
import { SERVICE_NAME, SERVICE_VERSION } from './configuration';

app.get('/', function( req, res ) {
  res.send(`Hello, you have reached ${SERVICE_NAME} v${SERVICE_VERSION}! I'm doing just fine ^^`);
});

app.use(errorHandler);