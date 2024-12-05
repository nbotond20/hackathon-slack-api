import Boom, { Boom as BoomError } from '@hapi/boom'
import { NextFunction, Request, Response } from 'express'

// Custom error handler that returns a JSON object with the error message
const errorHandler = (err: BoomError, _req: Request, res: Response, next: NextFunction) => {
  const boomError: BoomError = Boom.isBoom(err) ? err : Boom.boomify(err)
  res.status(boomError.output.statusCode).json({
    status: boomError.output.statusCode,
    message: Boom.isBoom(err) ? err.message : 'Internal server error',
    ...(Boom.isBoom(err) &&
      err.data && {
        data: {
          ...boomError.data,
        },
      }),
  })
  next()
}

export default errorHandler
