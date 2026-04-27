
/**
 * Client
**/

import * as runtime from './runtime/client.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model User
 * 
 */
export type User = $Result.DefaultSelection<Prisma.$UserPayload>
/**
 * Model UserPersonaXp
 * 
 */
export type UserPersonaXp = $Result.DefaultSelection<Prisma.$UserPersonaXpPayload>
/**
 * Model UserMemory
 * 
 */
export type UserMemory = $Result.DefaultSelection<Prisma.$UserMemoryPayload>
/**
 * Model Persona
 * 
 */
export type Persona = $Result.DefaultSelection<Prisma.$PersonaPayload>
/**
 * Model PersonaImage
 * 
 */
export type PersonaImage = $Result.DefaultSelection<Prisma.$PersonaImagePayload>
/**
 * Model PersonaVideo
 * 
 */
export type PersonaVideo = $Result.DefaultSelection<Prisma.$PersonaVideoPayload>
/**
 * Model ChatSession
 * 
 */
export type ChatSession = $Result.DefaultSelection<Prisma.$ChatSessionPayload>
/**
 * Model Message
 * 
 */
export type Message = $Result.DefaultSelection<Prisma.$MessagePayload>
/**
 * Model ConversationSummary
 * 
 */
export type ConversationSummary = $Result.DefaultSelection<Prisma.$ConversationSummaryPayload>
/**
 * Model AppConfig
 * 
 */
export type AppConfig = $Result.DefaultSelection<Prisma.$AppConfigPayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient({
 *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
 * })
 * // Fetch zero or more Users
 * const users = await prisma.user.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://pris.ly/d/client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient({
   *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
   * })
   * // Fetch zero or more Users
   * const users = await prisma.user.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://pris.ly/d/client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/orm/prisma-client/queries/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>

  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.user`: Exposes CRUD operations for the **User** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Users
    * const users = await prisma.user.findMany()
    * ```
    */
  get user(): Prisma.UserDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.userPersonaXp`: Exposes CRUD operations for the **UserPersonaXp** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more UserPersonaXps
    * const userPersonaXps = await prisma.userPersonaXp.findMany()
    * ```
    */
  get userPersonaXp(): Prisma.UserPersonaXpDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.userMemory`: Exposes CRUD operations for the **UserMemory** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more UserMemories
    * const userMemories = await prisma.userMemory.findMany()
    * ```
    */
  get userMemory(): Prisma.UserMemoryDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.persona`: Exposes CRUD operations for the **Persona** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Personas
    * const personas = await prisma.persona.findMany()
    * ```
    */
  get persona(): Prisma.PersonaDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.personaImage`: Exposes CRUD operations for the **PersonaImage** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PersonaImages
    * const personaImages = await prisma.personaImage.findMany()
    * ```
    */
  get personaImage(): Prisma.PersonaImageDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.personaVideo`: Exposes CRUD operations for the **PersonaVideo** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PersonaVideos
    * const personaVideos = await prisma.personaVideo.findMany()
    * ```
    */
  get personaVideo(): Prisma.PersonaVideoDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.chatSession`: Exposes CRUD operations for the **ChatSession** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ChatSessions
    * const chatSessions = await prisma.chatSession.findMany()
    * ```
    */
  get chatSession(): Prisma.ChatSessionDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.message`: Exposes CRUD operations for the **Message** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Messages
    * const messages = await prisma.message.findMany()
    * ```
    */
  get message(): Prisma.MessageDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.conversationSummary`: Exposes CRUD operations for the **ConversationSummary** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ConversationSummaries
    * const conversationSummaries = await prisma.conversationSummary.findMany()
    * ```
    */
  get conversationSummary(): Prisma.ConversationSummaryDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.appConfig`: Exposes CRUD operations for the **AppConfig** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more AppConfigs
    * const appConfigs = await prisma.appConfig.findMany()
    * ```
    */
  get appConfig(): Prisma.AppConfigDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 7.7.0
   * Query Engine version: 75cbdc1eb7150937890ad5465d861175c6624711
   */
  export type PrismaVersion = {
    client: string
    engine: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import Bytes = runtime.Bytes
  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    User: 'User',
    UserPersonaXp: 'UserPersonaXp',
    UserMemory: 'UserMemory',
    Persona: 'Persona',
    PersonaImage: 'PersonaImage',
    PersonaVideo: 'PersonaVideo',
    ChatSession: 'ChatSession',
    Message: 'Message',
    ConversationSummary: 'ConversationSummary',
    AppConfig: 'AppConfig'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]



  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "user" | "userPersonaXp" | "userMemory" | "persona" | "personaImage" | "personaVideo" | "chatSession" | "message" | "conversationSummary" | "appConfig"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      User: {
        payload: Prisma.$UserPayload<ExtArgs>
        fields: Prisma.UserFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findFirst: {
            args: Prisma.UserFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findMany: {
            args: Prisma.UserFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          create: {
            args: Prisma.UserCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          createMany: {
            args: Prisma.UserCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          delete: {
            args: Prisma.UserDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          update: {
            args: Prisma.UserUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          deleteMany: {
            args: Prisma.UserDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.UserUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          upsert: {
            args: Prisma.UserUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          aggregate: {
            args: Prisma.UserAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUser>
          }
          groupBy: {
            args: Prisma.UserGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserCountArgs<ExtArgs>
            result: $Utils.Optional<UserCountAggregateOutputType> | number
          }
        }
      }
      UserPersonaXp: {
        payload: Prisma.$UserPersonaXpPayload<ExtArgs>
        fields: Prisma.UserPersonaXpFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserPersonaXpFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPersonaXpPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserPersonaXpFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPersonaXpPayload>
          }
          findFirst: {
            args: Prisma.UserPersonaXpFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPersonaXpPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserPersonaXpFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPersonaXpPayload>
          }
          findMany: {
            args: Prisma.UserPersonaXpFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPersonaXpPayload>[]
          }
          create: {
            args: Prisma.UserPersonaXpCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPersonaXpPayload>
          }
          createMany: {
            args: Prisma.UserPersonaXpCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserPersonaXpCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPersonaXpPayload>[]
          }
          delete: {
            args: Prisma.UserPersonaXpDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPersonaXpPayload>
          }
          update: {
            args: Prisma.UserPersonaXpUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPersonaXpPayload>
          }
          deleteMany: {
            args: Prisma.UserPersonaXpDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserPersonaXpUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.UserPersonaXpUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPersonaXpPayload>[]
          }
          upsert: {
            args: Prisma.UserPersonaXpUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPersonaXpPayload>
          }
          aggregate: {
            args: Prisma.UserPersonaXpAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUserPersonaXp>
          }
          groupBy: {
            args: Prisma.UserPersonaXpGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserPersonaXpGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserPersonaXpCountArgs<ExtArgs>
            result: $Utils.Optional<UserPersonaXpCountAggregateOutputType> | number
          }
        }
      }
      UserMemory: {
        payload: Prisma.$UserMemoryPayload<ExtArgs>
        fields: Prisma.UserMemoryFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserMemoryFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserMemoryPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserMemoryFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserMemoryPayload>
          }
          findFirst: {
            args: Prisma.UserMemoryFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserMemoryPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserMemoryFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserMemoryPayload>
          }
          findMany: {
            args: Prisma.UserMemoryFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserMemoryPayload>[]
          }
          create: {
            args: Prisma.UserMemoryCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserMemoryPayload>
          }
          createMany: {
            args: Prisma.UserMemoryCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserMemoryCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserMemoryPayload>[]
          }
          delete: {
            args: Prisma.UserMemoryDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserMemoryPayload>
          }
          update: {
            args: Prisma.UserMemoryUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserMemoryPayload>
          }
          deleteMany: {
            args: Prisma.UserMemoryDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserMemoryUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.UserMemoryUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserMemoryPayload>[]
          }
          upsert: {
            args: Prisma.UserMemoryUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserMemoryPayload>
          }
          aggregate: {
            args: Prisma.UserMemoryAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUserMemory>
          }
          groupBy: {
            args: Prisma.UserMemoryGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserMemoryGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserMemoryCountArgs<ExtArgs>
            result: $Utils.Optional<UserMemoryCountAggregateOutputType> | number
          }
        }
      }
      Persona: {
        payload: Prisma.$PersonaPayload<ExtArgs>
        fields: Prisma.PersonaFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PersonaFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PersonaFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaPayload>
          }
          findFirst: {
            args: Prisma.PersonaFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PersonaFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaPayload>
          }
          findMany: {
            args: Prisma.PersonaFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaPayload>[]
          }
          create: {
            args: Prisma.PersonaCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaPayload>
          }
          createMany: {
            args: Prisma.PersonaCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PersonaCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaPayload>[]
          }
          delete: {
            args: Prisma.PersonaDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaPayload>
          }
          update: {
            args: Prisma.PersonaUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaPayload>
          }
          deleteMany: {
            args: Prisma.PersonaDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PersonaUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.PersonaUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaPayload>[]
          }
          upsert: {
            args: Prisma.PersonaUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaPayload>
          }
          aggregate: {
            args: Prisma.PersonaAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePersona>
          }
          groupBy: {
            args: Prisma.PersonaGroupByArgs<ExtArgs>
            result: $Utils.Optional<PersonaGroupByOutputType>[]
          }
          count: {
            args: Prisma.PersonaCountArgs<ExtArgs>
            result: $Utils.Optional<PersonaCountAggregateOutputType> | number
          }
        }
      }
      PersonaImage: {
        payload: Prisma.$PersonaImagePayload<ExtArgs>
        fields: Prisma.PersonaImageFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PersonaImageFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaImagePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PersonaImageFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaImagePayload>
          }
          findFirst: {
            args: Prisma.PersonaImageFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaImagePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PersonaImageFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaImagePayload>
          }
          findMany: {
            args: Prisma.PersonaImageFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaImagePayload>[]
          }
          create: {
            args: Prisma.PersonaImageCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaImagePayload>
          }
          createMany: {
            args: Prisma.PersonaImageCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PersonaImageCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaImagePayload>[]
          }
          delete: {
            args: Prisma.PersonaImageDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaImagePayload>
          }
          update: {
            args: Prisma.PersonaImageUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaImagePayload>
          }
          deleteMany: {
            args: Prisma.PersonaImageDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PersonaImageUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.PersonaImageUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaImagePayload>[]
          }
          upsert: {
            args: Prisma.PersonaImageUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaImagePayload>
          }
          aggregate: {
            args: Prisma.PersonaImageAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePersonaImage>
          }
          groupBy: {
            args: Prisma.PersonaImageGroupByArgs<ExtArgs>
            result: $Utils.Optional<PersonaImageGroupByOutputType>[]
          }
          count: {
            args: Prisma.PersonaImageCountArgs<ExtArgs>
            result: $Utils.Optional<PersonaImageCountAggregateOutputType> | number
          }
        }
      }
      PersonaVideo: {
        payload: Prisma.$PersonaVideoPayload<ExtArgs>
        fields: Prisma.PersonaVideoFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PersonaVideoFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaVideoPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PersonaVideoFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaVideoPayload>
          }
          findFirst: {
            args: Prisma.PersonaVideoFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaVideoPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PersonaVideoFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaVideoPayload>
          }
          findMany: {
            args: Prisma.PersonaVideoFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaVideoPayload>[]
          }
          create: {
            args: Prisma.PersonaVideoCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaVideoPayload>
          }
          createMany: {
            args: Prisma.PersonaVideoCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PersonaVideoCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaVideoPayload>[]
          }
          delete: {
            args: Prisma.PersonaVideoDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaVideoPayload>
          }
          update: {
            args: Prisma.PersonaVideoUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaVideoPayload>
          }
          deleteMany: {
            args: Prisma.PersonaVideoDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PersonaVideoUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.PersonaVideoUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaVideoPayload>[]
          }
          upsert: {
            args: Prisma.PersonaVideoUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PersonaVideoPayload>
          }
          aggregate: {
            args: Prisma.PersonaVideoAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePersonaVideo>
          }
          groupBy: {
            args: Prisma.PersonaVideoGroupByArgs<ExtArgs>
            result: $Utils.Optional<PersonaVideoGroupByOutputType>[]
          }
          count: {
            args: Prisma.PersonaVideoCountArgs<ExtArgs>
            result: $Utils.Optional<PersonaVideoCountAggregateOutputType> | number
          }
        }
      }
      ChatSession: {
        payload: Prisma.$ChatSessionPayload<ExtArgs>
        fields: Prisma.ChatSessionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ChatSessionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ChatSessionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ChatSessionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ChatSessionPayload>
          }
          findFirst: {
            args: Prisma.ChatSessionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ChatSessionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ChatSessionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ChatSessionPayload>
          }
          findMany: {
            args: Prisma.ChatSessionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ChatSessionPayload>[]
          }
          create: {
            args: Prisma.ChatSessionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ChatSessionPayload>
          }
          createMany: {
            args: Prisma.ChatSessionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ChatSessionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ChatSessionPayload>[]
          }
          delete: {
            args: Prisma.ChatSessionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ChatSessionPayload>
          }
          update: {
            args: Prisma.ChatSessionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ChatSessionPayload>
          }
          deleteMany: {
            args: Prisma.ChatSessionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ChatSessionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.ChatSessionUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ChatSessionPayload>[]
          }
          upsert: {
            args: Prisma.ChatSessionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ChatSessionPayload>
          }
          aggregate: {
            args: Prisma.ChatSessionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateChatSession>
          }
          groupBy: {
            args: Prisma.ChatSessionGroupByArgs<ExtArgs>
            result: $Utils.Optional<ChatSessionGroupByOutputType>[]
          }
          count: {
            args: Prisma.ChatSessionCountArgs<ExtArgs>
            result: $Utils.Optional<ChatSessionCountAggregateOutputType> | number
          }
        }
      }
      Message: {
        payload: Prisma.$MessagePayload<ExtArgs>
        fields: Prisma.MessageFieldRefs
        operations: {
          findUnique: {
            args: Prisma.MessageFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.MessageFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload>
          }
          findFirst: {
            args: Prisma.MessageFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.MessageFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload>
          }
          findMany: {
            args: Prisma.MessageFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload>[]
          }
          create: {
            args: Prisma.MessageCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload>
          }
          createMany: {
            args: Prisma.MessageCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.MessageCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload>[]
          }
          delete: {
            args: Prisma.MessageDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload>
          }
          update: {
            args: Prisma.MessageUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload>
          }
          deleteMany: {
            args: Prisma.MessageDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.MessageUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.MessageUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload>[]
          }
          upsert: {
            args: Prisma.MessageUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload>
          }
          aggregate: {
            args: Prisma.MessageAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateMessage>
          }
          groupBy: {
            args: Prisma.MessageGroupByArgs<ExtArgs>
            result: $Utils.Optional<MessageGroupByOutputType>[]
          }
          count: {
            args: Prisma.MessageCountArgs<ExtArgs>
            result: $Utils.Optional<MessageCountAggregateOutputType> | number
          }
        }
      }
      ConversationSummary: {
        payload: Prisma.$ConversationSummaryPayload<ExtArgs>
        fields: Prisma.ConversationSummaryFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ConversationSummaryFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConversationSummaryPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ConversationSummaryFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConversationSummaryPayload>
          }
          findFirst: {
            args: Prisma.ConversationSummaryFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConversationSummaryPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ConversationSummaryFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConversationSummaryPayload>
          }
          findMany: {
            args: Prisma.ConversationSummaryFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConversationSummaryPayload>[]
          }
          create: {
            args: Prisma.ConversationSummaryCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConversationSummaryPayload>
          }
          createMany: {
            args: Prisma.ConversationSummaryCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ConversationSummaryCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConversationSummaryPayload>[]
          }
          delete: {
            args: Prisma.ConversationSummaryDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConversationSummaryPayload>
          }
          update: {
            args: Prisma.ConversationSummaryUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConversationSummaryPayload>
          }
          deleteMany: {
            args: Prisma.ConversationSummaryDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ConversationSummaryUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.ConversationSummaryUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConversationSummaryPayload>[]
          }
          upsert: {
            args: Prisma.ConversationSummaryUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConversationSummaryPayload>
          }
          aggregate: {
            args: Prisma.ConversationSummaryAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateConversationSummary>
          }
          groupBy: {
            args: Prisma.ConversationSummaryGroupByArgs<ExtArgs>
            result: $Utils.Optional<ConversationSummaryGroupByOutputType>[]
          }
          count: {
            args: Prisma.ConversationSummaryCountArgs<ExtArgs>
            result: $Utils.Optional<ConversationSummaryCountAggregateOutputType> | number
          }
        }
      }
      AppConfig: {
        payload: Prisma.$AppConfigPayload<ExtArgs>
        fields: Prisma.AppConfigFieldRefs
        operations: {
          findUnique: {
            args: Prisma.AppConfigFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AppConfigPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.AppConfigFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AppConfigPayload>
          }
          findFirst: {
            args: Prisma.AppConfigFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AppConfigPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.AppConfigFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AppConfigPayload>
          }
          findMany: {
            args: Prisma.AppConfigFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AppConfigPayload>[]
          }
          create: {
            args: Prisma.AppConfigCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AppConfigPayload>
          }
          createMany: {
            args: Prisma.AppConfigCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.AppConfigCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AppConfigPayload>[]
          }
          delete: {
            args: Prisma.AppConfigDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AppConfigPayload>
          }
          update: {
            args: Prisma.AppConfigUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AppConfigPayload>
          }
          deleteMany: {
            args: Prisma.AppConfigDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.AppConfigUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.AppConfigUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AppConfigPayload>[]
          }
          upsert: {
            args: Prisma.AppConfigUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AppConfigPayload>
          }
          aggregate: {
            args: Prisma.AppConfigAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateAppConfig>
          }
          groupBy: {
            args: Prisma.AppConfigGroupByArgs<ExtArgs>
            result: $Utils.Optional<AppConfigGroupByOutputType>[]
          }
          count: {
            args: Prisma.AppConfigCountArgs<ExtArgs>
            result: $Utils.Optional<AppConfigCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     * 
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * 
     * ```
     * Read more in our [docs](https://pris.ly/d/logging).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`
     */
    adapter?: runtime.SqlDriverAdapterFactory
    /**
     * Prisma Accelerate URL allowing the client to connect through Accelerate instead of a direct database.
     */
    accelerateUrl?: string
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
    /**
     * SQL commenter plugins that add metadata to SQL queries as comments.
     * Comments follow the sqlcommenter format: https://google.github.io/sqlcommenter/
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   adapter,
     *   comments: [
     *     traceContext(),
     *     queryInsights(),
     *   ],
     * })
     * ```
     */
    comments?: runtime.SqlCommenterPlugin[]
  }
  export type GlobalOmitConfig = {
    user?: UserOmit
    userPersonaXp?: UserPersonaXpOmit
    userMemory?: UserMemoryOmit
    persona?: PersonaOmit
    personaImage?: PersonaImageOmit
    personaVideo?: PersonaVideoOmit
    chatSession?: ChatSessionOmit
    message?: MessageOmit
    conversationSummary?: ConversationSummaryOmit
    appConfig?: AppConfigOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T['level'] : T
  >;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
    ? GetLogType<T[number]>
    : never;

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type UserCountOutputType
   */

  export type UserCountOutputType = {
    personas: number
    sessions: number
    memories: number
    personaXps: number
  }

  export type UserCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    personas?: boolean | UserCountOutputTypeCountPersonasArgs
    sessions?: boolean | UserCountOutputTypeCountSessionsArgs
    memories?: boolean | UserCountOutputTypeCountMemoriesArgs
    personaXps?: boolean | UserCountOutputTypeCountPersonaXpsArgs
  }

  // Custom InputTypes
  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserCountOutputType
     */
    select?: UserCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountPersonasArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PersonaWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountSessionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ChatSessionWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountMemoriesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserMemoryWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountPersonaXpsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserPersonaXpWhereInput
  }


  /**
   * Count Type PersonaCountOutputType
   */

  export type PersonaCountOutputType = {
    sessions: number
    images: number
    personaXps: number
  }

  export type PersonaCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    sessions?: boolean | PersonaCountOutputTypeCountSessionsArgs
    images?: boolean | PersonaCountOutputTypeCountImagesArgs
    personaXps?: boolean | PersonaCountOutputTypeCountPersonaXpsArgs
  }

  // Custom InputTypes
  /**
   * PersonaCountOutputType without action
   */
  export type PersonaCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaCountOutputType
     */
    select?: PersonaCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * PersonaCountOutputType without action
   */
  export type PersonaCountOutputTypeCountSessionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ChatSessionWhereInput
  }

  /**
   * PersonaCountOutputType without action
   */
  export type PersonaCountOutputTypeCountImagesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PersonaImageWhereInput
  }

  /**
   * PersonaCountOutputType without action
   */
  export type PersonaCountOutputTypeCountPersonaXpsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserPersonaXpWhereInput
  }


  /**
   * Count Type PersonaImageCountOutputType
   */

  export type PersonaImageCountOutputType = {
    videos: number
  }

  export type PersonaImageCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    videos?: boolean | PersonaImageCountOutputTypeCountVideosArgs
  }

  // Custom InputTypes
  /**
   * PersonaImageCountOutputType without action
   */
  export type PersonaImageCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaImageCountOutputType
     */
    select?: PersonaImageCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * PersonaImageCountOutputType without action
   */
  export type PersonaImageCountOutputTypeCountVideosArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PersonaVideoWhereInput
  }


  /**
   * Count Type ChatSessionCountOutputType
   */

  export type ChatSessionCountOutputType = {
    messages: number
  }

  export type ChatSessionCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    messages?: boolean | ChatSessionCountOutputTypeCountMessagesArgs
  }

  // Custom InputTypes
  /**
   * ChatSessionCountOutputType without action
   */
  export type ChatSessionCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ChatSessionCountOutputType
     */
    select?: ChatSessionCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * ChatSessionCountOutputType without action
   */
  export type ChatSessionCountOutputTypeCountMessagesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: MessageWhereInput
  }


  /**
   * Models
   */

  /**
   * Model User
   */

  export type AggregateUser = {
    _count: UserCountAggregateOutputType | null
    _avg: UserAvgAggregateOutputType | null
    _sum: UserSumAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  export type UserAvgAggregateOutputType = {
    id: number | null
  }

  export type UserSumAggregateOutputType = {
    id: number | null
  }

  export type UserMinAggregateOutputType = {
    id: number | null
    email: string | null
    password: string | null
    username: string | null
    role: string | null
    resetToken: string | null
    resetTokenExpiry: Date | null
    createdAt: Date | null
  }

  export type UserMaxAggregateOutputType = {
    id: number | null
    email: string | null
    password: string | null
    username: string | null
    role: string | null
    resetToken: string | null
    resetTokenExpiry: Date | null
    createdAt: Date | null
  }

  export type UserCountAggregateOutputType = {
    id: number
    email: number
    password: number
    username: number
    role: number
    resetToken: number
    resetTokenExpiry: number
    createdAt: number
    _all: number
  }


  export type UserAvgAggregateInputType = {
    id?: true
  }

  export type UserSumAggregateInputType = {
    id?: true
  }

  export type UserMinAggregateInputType = {
    id?: true
    email?: true
    password?: true
    username?: true
    role?: true
    resetToken?: true
    resetTokenExpiry?: true
    createdAt?: true
  }

  export type UserMaxAggregateInputType = {
    id?: true
    email?: true
    password?: true
    username?: true
    role?: true
    resetToken?: true
    resetTokenExpiry?: true
    createdAt?: true
  }

  export type UserCountAggregateInputType = {
    id?: true
    email?: true
    password?: true
    username?: true
    role?: true
    resetToken?: true
    resetTokenExpiry?: true
    createdAt?: true
    _all?: true
  }

  export type UserAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which User to aggregate.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Users
    **/
    _count?: true | UserCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: UserAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: UserSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserMaxAggregateInputType
  }

  export type GetUserAggregateType<T extends UserAggregateArgs> = {
        [P in keyof T & keyof AggregateUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUser[P]>
      : GetScalarType<T[P], AggregateUser[P]>
  }




  export type UserGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
    orderBy?: UserOrderByWithAggregationInput | UserOrderByWithAggregationInput[]
    by: UserScalarFieldEnum[] | UserScalarFieldEnum
    having?: UserScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserCountAggregateInputType | true
    _avg?: UserAvgAggregateInputType
    _sum?: UserSumAggregateInputType
    _min?: UserMinAggregateInputType
    _max?: UserMaxAggregateInputType
  }

  export type UserGroupByOutputType = {
    id: number
    email: string
    password: string
    username: string | null
    role: string
    resetToken: string | null
    resetTokenExpiry: Date | null
    createdAt: Date
    _count: UserCountAggregateOutputType | null
    _avg: UserAvgAggregateOutputType | null
    _sum: UserSumAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  type GetUserGroupByPayload<T extends UserGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserGroupByOutputType[P]>
            : GetScalarType<T[P], UserGroupByOutputType[P]>
        }
      >
    >


  export type UserSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    password?: boolean
    username?: boolean
    role?: boolean
    resetToken?: boolean
    resetTokenExpiry?: boolean
    createdAt?: boolean
    personas?: boolean | User$personasArgs<ExtArgs>
    sessions?: boolean | User$sessionsArgs<ExtArgs>
    memories?: boolean | User$memoriesArgs<ExtArgs>
    personaXps?: boolean | User$personaXpsArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>

  export type UserSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    password?: boolean
    username?: boolean
    role?: boolean
    resetToken?: boolean
    resetTokenExpiry?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    password?: boolean
    username?: boolean
    role?: boolean
    resetToken?: boolean
    resetTokenExpiry?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectScalar = {
    id?: boolean
    email?: boolean
    password?: boolean
    username?: boolean
    role?: boolean
    resetToken?: boolean
    resetTokenExpiry?: boolean
    createdAt?: boolean
  }

  export type UserOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "email" | "password" | "username" | "role" | "resetToken" | "resetTokenExpiry" | "createdAt", ExtArgs["result"]["user"]>
  export type UserInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    personas?: boolean | User$personasArgs<ExtArgs>
    sessions?: boolean | User$sessionsArgs<ExtArgs>
    memories?: boolean | User$memoriesArgs<ExtArgs>
    personaXps?: boolean | User$personaXpsArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type UserIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type UserIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $UserPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "User"
    objects: {
      personas: Prisma.$PersonaPayload<ExtArgs>[]
      sessions: Prisma.$ChatSessionPayload<ExtArgs>[]
      memories: Prisma.$UserMemoryPayload<ExtArgs>[]
      personaXps: Prisma.$UserPersonaXpPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      email: string
      password: string
      username: string | null
      role: string
      resetToken: string | null
      resetTokenExpiry: Date | null
      createdAt: Date
    }, ExtArgs["result"]["user"]>
    composites: {}
  }

  type UserGetPayload<S extends boolean | null | undefined | UserDefaultArgs> = $Result.GetResult<Prisma.$UserPayload, S>

  type UserCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<UserFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: UserCountAggregateInputType | true
    }

  export interface UserDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['User'], meta: { name: 'User' } }
    /**
     * Find zero or one User that matches the filter.
     * @param {UserFindUniqueArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserFindUniqueArgs>(args: SelectSubset<T, UserFindUniqueArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one User that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UserFindUniqueOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(args: SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserFindFirstArgs>(args?: SelectSubset<T, UserFindFirstArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(args?: SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Users
     * const users = await prisma.user.findMany()
     * 
     * // Get first 10 Users
     * const users = await prisma.user.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userWithIdOnly = await prisma.user.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends UserFindManyArgs>(args?: SelectSubset<T, UserFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a User.
     * @param {UserCreateArgs} args - Arguments to create a User.
     * @example
     * // Create one User
     * const User = await prisma.user.create({
     *   data: {
     *     // ... data to create a User
     *   }
     * })
     * 
     */
    create<T extends UserCreateArgs>(args: SelectSubset<T, UserCreateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Users.
     * @param {UserCreateManyArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserCreateManyArgs>(args?: SelectSubset<T, UserCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Users and returns the data saved in the database.
     * @param {UserCreateManyAndReturnArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Users and only return the `id`
     * const userWithIdOnly = await prisma.user.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserCreateManyAndReturnArgs>(args?: SelectSubset<T, UserCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a User.
     * @param {UserDeleteArgs} args - Arguments to delete one User.
     * @example
     * // Delete one User
     * const User = await prisma.user.delete({
     *   where: {
     *     // ... filter to delete one User
     *   }
     * })
     * 
     */
    delete<T extends UserDeleteArgs>(args: SelectSubset<T, UserDeleteArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one User.
     * @param {UserUpdateArgs} args - Arguments to update one User.
     * @example
     * // Update one User
     * const user = await prisma.user.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserUpdateArgs>(args: SelectSubset<T, UserUpdateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Users.
     * @param {UserDeleteManyArgs} args - Arguments to filter Users to delete.
     * @example
     * // Delete a few Users
     * const { count } = await prisma.user.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserDeleteManyArgs>(args?: SelectSubset<T, UserDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserUpdateManyArgs>(args: SelectSubset<T, UserUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users and returns the data updated in the database.
     * @param {UserUpdateManyAndReturnArgs} args - Arguments to update many Users.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Users and only return the `id`
     * const userWithIdOnly = await prisma.user.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends UserUpdateManyAndReturnArgs>(args: SelectSubset<T, UserUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one User.
     * @param {UserUpsertArgs} args - Arguments to update or create a User.
     * @example
     * // Update or create a User
     * const user = await prisma.user.upsert({
     *   create: {
     *     // ... data to create a User
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the User we want to update
     *   }
     * })
     */
    upsert<T extends UserUpsertArgs>(args: SelectSubset<T, UserUpsertArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserCountArgs} args - Arguments to filter Users to count.
     * @example
     * // Count the number of Users
     * const count = await prisma.user.count({
     *   where: {
     *     // ... the filter for the Users we want to count
     *   }
     * })
    **/
    count<T extends UserCountArgs>(
      args?: Subset<T, UserCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserAggregateArgs>(args: Subset<T, UserAggregateArgs>): Prisma.PrismaPromise<GetUserAggregateType<T>>

    /**
     * Group by User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserGroupByArgs['orderBy'] }
        : { orderBy?: UserGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the User model
   */
  readonly fields: UserFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for User.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    personas<T extends User$personasArgs<ExtArgs> = {}>(args?: Subset<T, User$personasArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonaPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    sessions<T extends User$sessionsArgs<ExtArgs> = {}>(args?: Subset<T, User$sessionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ChatSessionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    memories<T extends User$memoriesArgs<ExtArgs> = {}>(args?: Subset<T, User$memoriesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserMemoryPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    personaXps<T extends User$personaXpsArgs<ExtArgs> = {}>(args?: Subset<T, User$personaXpsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPersonaXpPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the User model
   */
  interface UserFieldRefs {
    readonly id: FieldRef<"User", 'Int'>
    readonly email: FieldRef<"User", 'String'>
    readonly password: FieldRef<"User", 'String'>
    readonly username: FieldRef<"User", 'String'>
    readonly role: FieldRef<"User", 'String'>
    readonly resetToken: FieldRef<"User", 'String'>
    readonly resetTokenExpiry: FieldRef<"User", 'DateTime'>
    readonly createdAt: FieldRef<"User", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * User findUnique
   */
  export type UserFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findUniqueOrThrow
   */
  export type UserFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findFirst
   */
  export type UserFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findFirstOrThrow
   */
  export type UserFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findMany
   */
  export type UserFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which Users to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User create
   */
  export type UserCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to create a User.
     */
    data: XOR<UserCreateInput, UserUncheckedCreateInput>
  }

  /**
   * User createMany
   */
  export type UserCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User createManyAndReturn
   */
  export type UserCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User update
   */
  export type UserUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to update a User.
     */
    data: XOR<UserUpdateInput, UserUncheckedUpdateInput>
    /**
     * Choose, which User to update.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User updateMany
   */
  export type UserUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User updateManyAndReturn
   */
  export type UserUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User upsert
   */
  export type UserUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The filter to search for the User to update in case it exists.
     */
    where: UserWhereUniqueInput
    /**
     * In case the User found by the `where` argument doesn't exist, create a new User with this data.
     */
    create: XOR<UserCreateInput, UserUncheckedCreateInput>
    /**
     * In case the User was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserUpdateInput, UserUncheckedUpdateInput>
  }

  /**
   * User delete
   */
  export type UserDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter which User to delete.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User deleteMany
   */
  export type UserDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Users to delete
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to delete.
     */
    limit?: number
  }

  /**
   * User.personas
   */
  export type User$personasArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Persona
     */
    select?: PersonaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Persona
     */
    omit?: PersonaOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaInclude<ExtArgs> | null
    where?: PersonaWhereInput
    orderBy?: PersonaOrderByWithRelationInput | PersonaOrderByWithRelationInput[]
    cursor?: PersonaWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PersonaScalarFieldEnum | PersonaScalarFieldEnum[]
  }

  /**
   * User.sessions
   */
  export type User$sessionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ChatSession
     */
    select?: ChatSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ChatSession
     */
    omit?: ChatSessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ChatSessionInclude<ExtArgs> | null
    where?: ChatSessionWhereInput
    orderBy?: ChatSessionOrderByWithRelationInput | ChatSessionOrderByWithRelationInput[]
    cursor?: ChatSessionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ChatSessionScalarFieldEnum | ChatSessionScalarFieldEnum[]
  }

  /**
   * User.memories
   */
  export type User$memoriesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserMemory
     */
    select?: UserMemorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserMemory
     */
    omit?: UserMemoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserMemoryInclude<ExtArgs> | null
    where?: UserMemoryWhereInput
    orderBy?: UserMemoryOrderByWithRelationInput | UserMemoryOrderByWithRelationInput[]
    cursor?: UserMemoryWhereUniqueInput
    take?: number
    skip?: number
    distinct?: UserMemoryScalarFieldEnum | UserMemoryScalarFieldEnum[]
  }

  /**
   * User.personaXps
   */
  export type User$personaXpsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserPersonaXp
     */
    select?: UserPersonaXpSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserPersonaXp
     */
    omit?: UserPersonaXpOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPersonaXpInclude<ExtArgs> | null
    where?: UserPersonaXpWhereInput
    orderBy?: UserPersonaXpOrderByWithRelationInput | UserPersonaXpOrderByWithRelationInput[]
    cursor?: UserPersonaXpWhereUniqueInput
    take?: number
    skip?: number
    distinct?: UserPersonaXpScalarFieldEnum | UserPersonaXpScalarFieldEnum[]
  }

  /**
   * User without action
   */
  export type UserDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
  }


  /**
   * Model UserPersonaXp
   */

  export type AggregateUserPersonaXp = {
    _count: UserPersonaXpCountAggregateOutputType | null
    _avg: UserPersonaXpAvgAggregateOutputType | null
    _sum: UserPersonaXpSumAggregateOutputType | null
    _min: UserPersonaXpMinAggregateOutputType | null
    _max: UserPersonaXpMaxAggregateOutputType | null
  }

  export type UserPersonaXpAvgAggregateOutputType = {
    userId: number | null
    xp: number | null
  }

  export type UserPersonaXpSumAggregateOutputType = {
    userId: number | null
    xp: number | null
  }

  export type UserPersonaXpMinAggregateOutputType = {
    userId: number | null
    personaId: string | null
    xp: number | null
  }

  export type UserPersonaXpMaxAggregateOutputType = {
    userId: number | null
    personaId: string | null
    xp: number | null
  }

  export type UserPersonaXpCountAggregateOutputType = {
    userId: number
    personaId: number
    xp: number
    _all: number
  }


  export type UserPersonaXpAvgAggregateInputType = {
    userId?: true
    xp?: true
  }

  export type UserPersonaXpSumAggregateInputType = {
    userId?: true
    xp?: true
  }

  export type UserPersonaXpMinAggregateInputType = {
    userId?: true
    personaId?: true
    xp?: true
  }

  export type UserPersonaXpMaxAggregateInputType = {
    userId?: true
    personaId?: true
    xp?: true
  }

  export type UserPersonaXpCountAggregateInputType = {
    userId?: true
    personaId?: true
    xp?: true
    _all?: true
  }

  export type UserPersonaXpAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which UserPersonaXp to aggregate.
     */
    where?: UserPersonaXpWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserPersonaXps to fetch.
     */
    orderBy?: UserPersonaXpOrderByWithRelationInput | UserPersonaXpOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserPersonaXpWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserPersonaXps from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserPersonaXps.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned UserPersonaXps
    **/
    _count?: true | UserPersonaXpCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: UserPersonaXpAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: UserPersonaXpSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserPersonaXpMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserPersonaXpMaxAggregateInputType
  }

  export type GetUserPersonaXpAggregateType<T extends UserPersonaXpAggregateArgs> = {
        [P in keyof T & keyof AggregateUserPersonaXp]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUserPersonaXp[P]>
      : GetScalarType<T[P], AggregateUserPersonaXp[P]>
  }




  export type UserPersonaXpGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserPersonaXpWhereInput
    orderBy?: UserPersonaXpOrderByWithAggregationInput | UserPersonaXpOrderByWithAggregationInput[]
    by: UserPersonaXpScalarFieldEnum[] | UserPersonaXpScalarFieldEnum
    having?: UserPersonaXpScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserPersonaXpCountAggregateInputType | true
    _avg?: UserPersonaXpAvgAggregateInputType
    _sum?: UserPersonaXpSumAggregateInputType
    _min?: UserPersonaXpMinAggregateInputType
    _max?: UserPersonaXpMaxAggregateInputType
  }

  export type UserPersonaXpGroupByOutputType = {
    userId: number
    personaId: string
    xp: number
    _count: UserPersonaXpCountAggregateOutputType | null
    _avg: UserPersonaXpAvgAggregateOutputType | null
    _sum: UserPersonaXpSumAggregateOutputType | null
    _min: UserPersonaXpMinAggregateOutputType | null
    _max: UserPersonaXpMaxAggregateOutputType | null
  }

  type GetUserPersonaXpGroupByPayload<T extends UserPersonaXpGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserPersonaXpGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserPersonaXpGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserPersonaXpGroupByOutputType[P]>
            : GetScalarType<T[P], UserPersonaXpGroupByOutputType[P]>
        }
      >
    >


  export type UserPersonaXpSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    userId?: boolean
    personaId?: boolean
    xp?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    persona?: boolean | PersonaDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["userPersonaXp"]>

  export type UserPersonaXpSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    userId?: boolean
    personaId?: boolean
    xp?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    persona?: boolean | PersonaDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["userPersonaXp"]>

  export type UserPersonaXpSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    userId?: boolean
    personaId?: boolean
    xp?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    persona?: boolean | PersonaDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["userPersonaXp"]>

  export type UserPersonaXpSelectScalar = {
    userId?: boolean
    personaId?: boolean
    xp?: boolean
  }

  export type UserPersonaXpOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"userId" | "personaId" | "xp", ExtArgs["result"]["userPersonaXp"]>
  export type UserPersonaXpInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    persona?: boolean | PersonaDefaultArgs<ExtArgs>
  }
  export type UserPersonaXpIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    persona?: boolean | PersonaDefaultArgs<ExtArgs>
  }
  export type UserPersonaXpIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    persona?: boolean | PersonaDefaultArgs<ExtArgs>
  }

  export type $UserPersonaXpPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "UserPersonaXp"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
      persona: Prisma.$PersonaPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      userId: number
      personaId: string
      xp: number
    }, ExtArgs["result"]["userPersonaXp"]>
    composites: {}
  }

  type UserPersonaXpGetPayload<S extends boolean | null | undefined | UserPersonaXpDefaultArgs> = $Result.GetResult<Prisma.$UserPersonaXpPayload, S>

  type UserPersonaXpCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<UserPersonaXpFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: UserPersonaXpCountAggregateInputType | true
    }

  export interface UserPersonaXpDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['UserPersonaXp'], meta: { name: 'UserPersonaXp' } }
    /**
     * Find zero or one UserPersonaXp that matches the filter.
     * @param {UserPersonaXpFindUniqueArgs} args - Arguments to find a UserPersonaXp
     * @example
     * // Get one UserPersonaXp
     * const userPersonaXp = await prisma.userPersonaXp.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserPersonaXpFindUniqueArgs>(args: SelectSubset<T, UserPersonaXpFindUniqueArgs<ExtArgs>>): Prisma__UserPersonaXpClient<$Result.GetResult<Prisma.$UserPersonaXpPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one UserPersonaXp that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UserPersonaXpFindUniqueOrThrowArgs} args - Arguments to find a UserPersonaXp
     * @example
     * // Get one UserPersonaXp
     * const userPersonaXp = await prisma.userPersonaXp.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserPersonaXpFindUniqueOrThrowArgs>(args: SelectSubset<T, UserPersonaXpFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserPersonaXpClient<$Result.GetResult<Prisma.$UserPersonaXpPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first UserPersonaXp that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserPersonaXpFindFirstArgs} args - Arguments to find a UserPersonaXp
     * @example
     * // Get one UserPersonaXp
     * const userPersonaXp = await prisma.userPersonaXp.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserPersonaXpFindFirstArgs>(args?: SelectSubset<T, UserPersonaXpFindFirstArgs<ExtArgs>>): Prisma__UserPersonaXpClient<$Result.GetResult<Prisma.$UserPersonaXpPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first UserPersonaXp that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserPersonaXpFindFirstOrThrowArgs} args - Arguments to find a UserPersonaXp
     * @example
     * // Get one UserPersonaXp
     * const userPersonaXp = await prisma.userPersonaXp.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserPersonaXpFindFirstOrThrowArgs>(args?: SelectSubset<T, UserPersonaXpFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserPersonaXpClient<$Result.GetResult<Prisma.$UserPersonaXpPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more UserPersonaXps that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserPersonaXpFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all UserPersonaXps
     * const userPersonaXps = await prisma.userPersonaXp.findMany()
     * 
     * // Get first 10 UserPersonaXps
     * const userPersonaXps = await prisma.userPersonaXp.findMany({ take: 10 })
     * 
     * // Only select the `userId`
     * const userPersonaXpWithUserIdOnly = await prisma.userPersonaXp.findMany({ select: { userId: true } })
     * 
     */
    findMany<T extends UserPersonaXpFindManyArgs>(args?: SelectSubset<T, UserPersonaXpFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPersonaXpPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a UserPersonaXp.
     * @param {UserPersonaXpCreateArgs} args - Arguments to create a UserPersonaXp.
     * @example
     * // Create one UserPersonaXp
     * const UserPersonaXp = await prisma.userPersonaXp.create({
     *   data: {
     *     // ... data to create a UserPersonaXp
     *   }
     * })
     * 
     */
    create<T extends UserPersonaXpCreateArgs>(args: SelectSubset<T, UserPersonaXpCreateArgs<ExtArgs>>): Prisma__UserPersonaXpClient<$Result.GetResult<Prisma.$UserPersonaXpPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many UserPersonaXps.
     * @param {UserPersonaXpCreateManyArgs} args - Arguments to create many UserPersonaXps.
     * @example
     * // Create many UserPersonaXps
     * const userPersonaXp = await prisma.userPersonaXp.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserPersonaXpCreateManyArgs>(args?: SelectSubset<T, UserPersonaXpCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many UserPersonaXps and returns the data saved in the database.
     * @param {UserPersonaXpCreateManyAndReturnArgs} args - Arguments to create many UserPersonaXps.
     * @example
     * // Create many UserPersonaXps
     * const userPersonaXp = await prisma.userPersonaXp.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many UserPersonaXps and only return the `userId`
     * const userPersonaXpWithUserIdOnly = await prisma.userPersonaXp.createManyAndReturn({
     *   select: { userId: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserPersonaXpCreateManyAndReturnArgs>(args?: SelectSubset<T, UserPersonaXpCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPersonaXpPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a UserPersonaXp.
     * @param {UserPersonaXpDeleteArgs} args - Arguments to delete one UserPersonaXp.
     * @example
     * // Delete one UserPersonaXp
     * const UserPersonaXp = await prisma.userPersonaXp.delete({
     *   where: {
     *     // ... filter to delete one UserPersonaXp
     *   }
     * })
     * 
     */
    delete<T extends UserPersonaXpDeleteArgs>(args: SelectSubset<T, UserPersonaXpDeleteArgs<ExtArgs>>): Prisma__UserPersonaXpClient<$Result.GetResult<Prisma.$UserPersonaXpPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one UserPersonaXp.
     * @param {UserPersonaXpUpdateArgs} args - Arguments to update one UserPersonaXp.
     * @example
     * // Update one UserPersonaXp
     * const userPersonaXp = await prisma.userPersonaXp.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserPersonaXpUpdateArgs>(args: SelectSubset<T, UserPersonaXpUpdateArgs<ExtArgs>>): Prisma__UserPersonaXpClient<$Result.GetResult<Prisma.$UserPersonaXpPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more UserPersonaXps.
     * @param {UserPersonaXpDeleteManyArgs} args - Arguments to filter UserPersonaXps to delete.
     * @example
     * // Delete a few UserPersonaXps
     * const { count } = await prisma.userPersonaXp.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserPersonaXpDeleteManyArgs>(args?: SelectSubset<T, UserPersonaXpDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more UserPersonaXps.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserPersonaXpUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many UserPersonaXps
     * const userPersonaXp = await prisma.userPersonaXp.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserPersonaXpUpdateManyArgs>(args: SelectSubset<T, UserPersonaXpUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more UserPersonaXps and returns the data updated in the database.
     * @param {UserPersonaXpUpdateManyAndReturnArgs} args - Arguments to update many UserPersonaXps.
     * @example
     * // Update many UserPersonaXps
     * const userPersonaXp = await prisma.userPersonaXp.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more UserPersonaXps and only return the `userId`
     * const userPersonaXpWithUserIdOnly = await prisma.userPersonaXp.updateManyAndReturn({
     *   select: { userId: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends UserPersonaXpUpdateManyAndReturnArgs>(args: SelectSubset<T, UserPersonaXpUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPersonaXpPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one UserPersonaXp.
     * @param {UserPersonaXpUpsertArgs} args - Arguments to update or create a UserPersonaXp.
     * @example
     * // Update or create a UserPersonaXp
     * const userPersonaXp = await prisma.userPersonaXp.upsert({
     *   create: {
     *     // ... data to create a UserPersonaXp
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the UserPersonaXp we want to update
     *   }
     * })
     */
    upsert<T extends UserPersonaXpUpsertArgs>(args: SelectSubset<T, UserPersonaXpUpsertArgs<ExtArgs>>): Prisma__UserPersonaXpClient<$Result.GetResult<Prisma.$UserPersonaXpPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of UserPersonaXps.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserPersonaXpCountArgs} args - Arguments to filter UserPersonaXps to count.
     * @example
     * // Count the number of UserPersonaXps
     * const count = await prisma.userPersonaXp.count({
     *   where: {
     *     // ... the filter for the UserPersonaXps we want to count
     *   }
     * })
    **/
    count<T extends UserPersonaXpCountArgs>(
      args?: Subset<T, UserPersonaXpCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserPersonaXpCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a UserPersonaXp.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserPersonaXpAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserPersonaXpAggregateArgs>(args: Subset<T, UserPersonaXpAggregateArgs>): Prisma.PrismaPromise<GetUserPersonaXpAggregateType<T>>

    /**
     * Group by UserPersonaXp.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserPersonaXpGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserPersonaXpGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserPersonaXpGroupByArgs['orderBy'] }
        : { orderBy?: UserPersonaXpGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserPersonaXpGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserPersonaXpGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the UserPersonaXp model
   */
  readonly fields: UserPersonaXpFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for UserPersonaXp.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserPersonaXpClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    persona<T extends PersonaDefaultArgs<ExtArgs> = {}>(args?: Subset<T, PersonaDefaultArgs<ExtArgs>>): Prisma__PersonaClient<$Result.GetResult<Prisma.$PersonaPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the UserPersonaXp model
   */
  interface UserPersonaXpFieldRefs {
    readonly userId: FieldRef<"UserPersonaXp", 'Int'>
    readonly personaId: FieldRef<"UserPersonaXp", 'String'>
    readonly xp: FieldRef<"UserPersonaXp", 'Int'>
  }
    

  // Custom InputTypes
  /**
   * UserPersonaXp findUnique
   */
  export type UserPersonaXpFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserPersonaXp
     */
    select?: UserPersonaXpSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserPersonaXp
     */
    omit?: UserPersonaXpOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPersonaXpInclude<ExtArgs> | null
    /**
     * Filter, which UserPersonaXp to fetch.
     */
    where: UserPersonaXpWhereUniqueInput
  }

  /**
   * UserPersonaXp findUniqueOrThrow
   */
  export type UserPersonaXpFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserPersonaXp
     */
    select?: UserPersonaXpSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserPersonaXp
     */
    omit?: UserPersonaXpOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPersonaXpInclude<ExtArgs> | null
    /**
     * Filter, which UserPersonaXp to fetch.
     */
    where: UserPersonaXpWhereUniqueInput
  }

  /**
   * UserPersonaXp findFirst
   */
  export type UserPersonaXpFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserPersonaXp
     */
    select?: UserPersonaXpSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserPersonaXp
     */
    omit?: UserPersonaXpOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPersonaXpInclude<ExtArgs> | null
    /**
     * Filter, which UserPersonaXp to fetch.
     */
    where?: UserPersonaXpWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserPersonaXps to fetch.
     */
    orderBy?: UserPersonaXpOrderByWithRelationInput | UserPersonaXpOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for UserPersonaXps.
     */
    cursor?: UserPersonaXpWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserPersonaXps from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserPersonaXps.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UserPersonaXps.
     */
    distinct?: UserPersonaXpScalarFieldEnum | UserPersonaXpScalarFieldEnum[]
  }

  /**
   * UserPersonaXp findFirstOrThrow
   */
  export type UserPersonaXpFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserPersonaXp
     */
    select?: UserPersonaXpSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserPersonaXp
     */
    omit?: UserPersonaXpOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPersonaXpInclude<ExtArgs> | null
    /**
     * Filter, which UserPersonaXp to fetch.
     */
    where?: UserPersonaXpWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserPersonaXps to fetch.
     */
    orderBy?: UserPersonaXpOrderByWithRelationInput | UserPersonaXpOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for UserPersonaXps.
     */
    cursor?: UserPersonaXpWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserPersonaXps from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserPersonaXps.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UserPersonaXps.
     */
    distinct?: UserPersonaXpScalarFieldEnum | UserPersonaXpScalarFieldEnum[]
  }

  /**
   * UserPersonaXp findMany
   */
  export type UserPersonaXpFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserPersonaXp
     */
    select?: UserPersonaXpSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserPersonaXp
     */
    omit?: UserPersonaXpOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPersonaXpInclude<ExtArgs> | null
    /**
     * Filter, which UserPersonaXps to fetch.
     */
    where?: UserPersonaXpWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserPersonaXps to fetch.
     */
    orderBy?: UserPersonaXpOrderByWithRelationInput | UserPersonaXpOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing UserPersonaXps.
     */
    cursor?: UserPersonaXpWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserPersonaXps from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserPersonaXps.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UserPersonaXps.
     */
    distinct?: UserPersonaXpScalarFieldEnum | UserPersonaXpScalarFieldEnum[]
  }

  /**
   * UserPersonaXp create
   */
  export type UserPersonaXpCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserPersonaXp
     */
    select?: UserPersonaXpSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserPersonaXp
     */
    omit?: UserPersonaXpOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPersonaXpInclude<ExtArgs> | null
    /**
     * The data needed to create a UserPersonaXp.
     */
    data: XOR<UserPersonaXpCreateInput, UserPersonaXpUncheckedCreateInput>
  }

  /**
   * UserPersonaXp createMany
   */
  export type UserPersonaXpCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many UserPersonaXps.
     */
    data: UserPersonaXpCreateManyInput | UserPersonaXpCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * UserPersonaXp createManyAndReturn
   */
  export type UserPersonaXpCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserPersonaXp
     */
    select?: UserPersonaXpSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the UserPersonaXp
     */
    omit?: UserPersonaXpOmit<ExtArgs> | null
    /**
     * The data used to create many UserPersonaXps.
     */
    data: UserPersonaXpCreateManyInput | UserPersonaXpCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPersonaXpIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * UserPersonaXp update
   */
  export type UserPersonaXpUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserPersonaXp
     */
    select?: UserPersonaXpSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserPersonaXp
     */
    omit?: UserPersonaXpOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPersonaXpInclude<ExtArgs> | null
    /**
     * The data needed to update a UserPersonaXp.
     */
    data: XOR<UserPersonaXpUpdateInput, UserPersonaXpUncheckedUpdateInput>
    /**
     * Choose, which UserPersonaXp to update.
     */
    where: UserPersonaXpWhereUniqueInput
  }

  /**
   * UserPersonaXp updateMany
   */
  export type UserPersonaXpUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update UserPersonaXps.
     */
    data: XOR<UserPersonaXpUpdateManyMutationInput, UserPersonaXpUncheckedUpdateManyInput>
    /**
     * Filter which UserPersonaXps to update
     */
    where?: UserPersonaXpWhereInput
    /**
     * Limit how many UserPersonaXps to update.
     */
    limit?: number
  }

  /**
   * UserPersonaXp updateManyAndReturn
   */
  export type UserPersonaXpUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserPersonaXp
     */
    select?: UserPersonaXpSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the UserPersonaXp
     */
    omit?: UserPersonaXpOmit<ExtArgs> | null
    /**
     * The data used to update UserPersonaXps.
     */
    data: XOR<UserPersonaXpUpdateManyMutationInput, UserPersonaXpUncheckedUpdateManyInput>
    /**
     * Filter which UserPersonaXps to update
     */
    where?: UserPersonaXpWhereInput
    /**
     * Limit how many UserPersonaXps to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPersonaXpIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * UserPersonaXp upsert
   */
  export type UserPersonaXpUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserPersonaXp
     */
    select?: UserPersonaXpSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserPersonaXp
     */
    omit?: UserPersonaXpOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPersonaXpInclude<ExtArgs> | null
    /**
     * The filter to search for the UserPersonaXp to update in case it exists.
     */
    where: UserPersonaXpWhereUniqueInput
    /**
     * In case the UserPersonaXp found by the `where` argument doesn't exist, create a new UserPersonaXp with this data.
     */
    create: XOR<UserPersonaXpCreateInput, UserPersonaXpUncheckedCreateInput>
    /**
     * In case the UserPersonaXp was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserPersonaXpUpdateInput, UserPersonaXpUncheckedUpdateInput>
  }

  /**
   * UserPersonaXp delete
   */
  export type UserPersonaXpDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserPersonaXp
     */
    select?: UserPersonaXpSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserPersonaXp
     */
    omit?: UserPersonaXpOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPersonaXpInclude<ExtArgs> | null
    /**
     * Filter which UserPersonaXp to delete.
     */
    where: UserPersonaXpWhereUniqueInput
  }

  /**
   * UserPersonaXp deleteMany
   */
  export type UserPersonaXpDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which UserPersonaXps to delete
     */
    where?: UserPersonaXpWhereInput
    /**
     * Limit how many UserPersonaXps to delete.
     */
    limit?: number
  }

  /**
   * UserPersonaXp without action
   */
  export type UserPersonaXpDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserPersonaXp
     */
    select?: UserPersonaXpSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserPersonaXp
     */
    omit?: UserPersonaXpOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPersonaXpInclude<ExtArgs> | null
  }


  /**
   * Model UserMemory
   */

  export type AggregateUserMemory = {
    _count: UserMemoryCountAggregateOutputType | null
    _avg: UserMemoryAvgAggregateOutputType | null
    _sum: UserMemorySumAggregateOutputType | null
    _min: UserMemoryMinAggregateOutputType | null
    _max: UserMemoryMaxAggregateOutputType | null
  }

  export type UserMemoryAvgAggregateOutputType = {
    id: number | null
    userId: number | null
  }

  export type UserMemorySumAggregateOutputType = {
    id: number | null
    userId: number | null
  }

  export type UserMemoryMinAggregateOutputType = {
    id: number | null
    userId: number | null
    content: string | null
    category: string | null
    createdAt: Date | null
  }

  export type UserMemoryMaxAggregateOutputType = {
    id: number | null
    userId: number | null
    content: string | null
    category: string | null
    createdAt: Date | null
  }

  export type UserMemoryCountAggregateOutputType = {
    id: number
    userId: number
    content: number
    category: number
    createdAt: number
    _all: number
  }


  export type UserMemoryAvgAggregateInputType = {
    id?: true
    userId?: true
  }

  export type UserMemorySumAggregateInputType = {
    id?: true
    userId?: true
  }

  export type UserMemoryMinAggregateInputType = {
    id?: true
    userId?: true
    content?: true
    category?: true
    createdAt?: true
  }

  export type UserMemoryMaxAggregateInputType = {
    id?: true
    userId?: true
    content?: true
    category?: true
    createdAt?: true
  }

  export type UserMemoryCountAggregateInputType = {
    id?: true
    userId?: true
    content?: true
    category?: true
    createdAt?: true
    _all?: true
  }

  export type UserMemoryAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which UserMemory to aggregate.
     */
    where?: UserMemoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserMemories to fetch.
     */
    orderBy?: UserMemoryOrderByWithRelationInput | UserMemoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserMemoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserMemories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserMemories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned UserMemories
    **/
    _count?: true | UserMemoryCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: UserMemoryAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: UserMemorySumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserMemoryMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserMemoryMaxAggregateInputType
  }

  export type GetUserMemoryAggregateType<T extends UserMemoryAggregateArgs> = {
        [P in keyof T & keyof AggregateUserMemory]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUserMemory[P]>
      : GetScalarType<T[P], AggregateUserMemory[P]>
  }




  export type UserMemoryGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserMemoryWhereInput
    orderBy?: UserMemoryOrderByWithAggregationInput | UserMemoryOrderByWithAggregationInput[]
    by: UserMemoryScalarFieldEnum[] | UserMemoryScalarFieldEnum
    having?: UserMemoryScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserMemoryCountAggregateInputType | true
    _avg?: UserMemoryAvgAggregateInputType
    _sum?: UserMemorySumAggregateInputType
    _min?: UserMemoryMinAggregateInputType
    _max?: UserMemoryMaxAggregateInputType
  }

  export type UserMemoryGroupByOutputType = {
    id: number
    userId: number
    content: string
    category: string | null
    createdAt: Date
    _count: UserMemoryCountAggregateOutputType | null
    _avg: UserMemoryAvgAggregateOutputType | null
    _sum: UserMemorySumAggregateOutputType | null
    _min: UserMemoryMinAggregateOutputType | null
    _max: UserMemoryMaxAggregateOutputType | null
  }

  type GetUserMemoryGroupByPayload<T extends UserMemoryGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserMemoryGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserMemoryGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserMemoryGroupByOutputType[P]>
            : GetScalarType<T[P], UserMemoryGroupByOutputType[P]>
        }
      >
    >


  export type UserMemorySelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    content?: boolean
    category?: boolean
    createdAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["userMemory"]>

  export type UserMemorySelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    content?: boolean
    category?: boolean
    createdAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["userMemory"]>

  export type UserMemorySelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    content?: boolean
    category?: boolean
    createdAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["userMemory"]>

  export type UserMemorySelectScalar = {
    id?: boolean
    userId?: boolean
    content?: boolean
    category?: boolean
    createdAt?: boolean
  }

  export type UserMemoryOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "content" | "category" | "createdAt", ExtArgs["result"]["userMemory"]>
  export type UserMemoryInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type UserMemoryIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type UserMemoryIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $UserMemoryPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "UserMemory"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      userId: number
      content: string
      category: string | null
      createdAt: Date
    }, ExtArgs["result"]["userMemory"]>
    composites: {}
  }

  type UserMemoryGetPayload<S extends boolean | null | undefined | UserMemoryDefaultArgs> = $Result.GetResult<Prisma.$UserMemoryPayload, S>

  type UserMemoryCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<UserMemoryFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: UserMemoryCountAggregateInputType | true
    }

  export interface UserMemoryDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['UserMemory'], meta: { name: 'UserMemory' } }
    /**
     * Find zero or one UserMemory that matches the filter.
     * @param {UserMemoryFindUniqueArgs} args - Arguments to find a UserMemory
     * @example
     * // Get one UserMemory
     * const userMemory = await prisma.userMemory.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserMemoryFindUniqueArgs>(args: SelectSubset<T, UserMemoryFindUniqueArgs<ExtArgs>>): Prisma__UserMemoryClient<$Result.GetResult<Prisma.$UserMemoryPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one UserMemory that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UserMemoryFindUniqueOrThrowArgs} args - Arguments to find a UserMemory
     * @example
     * // Get one UserMemory
     * const userMemory = await prisma.userMemory.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserMemoryFindUniqueOrThrowArgs>(args: SelectSubset<T, UserMemoryFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserMemoryClient<$Result.GetResult<Prisma.$UserMemoryPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first UserMemory that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserMemoryFindFirstArgs} args - Arguments to find a UserMemory
     * @example
     * // Get one UserMemory
     * const userMemory = await prisma.userMemory.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserMemoryFindFirstArgs>(args?: SelectSubset<T, UserMemoryFindFirstArgs<ExtArgs>>): Prisma__UserMemoryClient<$Result.GetResult<Prisma.$UserMemoryPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first UserMemory that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserMemoryFindFirstOrThrowArgs} args - Arguments to find a UserMemory
     * @example
     * // Get one UserMemory
     * const userMemory = await prisma.userMemory.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserMemoryFindFirstOrThrowArgs>(args?: SelectSubset<T, UserMemoryFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserMemoryClient<$Result.GetResult<Prisma.$UserMemoryPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more UserMemories that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserMemoryFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all UserMemories
     * const userMemories = await prisma.userMemory.findMany()
     * 
     * // Get first 10 UserMemories
     * const userMemories = await prisma.userMemory.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userMemoryWithIdOnly = await prisma.userMemory.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends UserMemoryFindManyArgs>(args?: SelectSubset<T, UserMemoryFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserMemoryPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a UserMemory.
     * @param {UserMemoryCreateArgs} args - Arguments to create a UserMemory.
     * @example
     * // Create one UserMemory
     * const UserMemory = await prisma.userMemory.create({
     *   data: {
     *     // ... data to create a UserMemory
     *   }
     * })
     * 
     */
    create<T extends UserMemoryCreateArgs>(args: SelectSubset<T, UserMemoryCreateArgs<ExtArgs>>): Prisma__UserMemoryClient<$Result.GetResult<Prisma.$UserMemoryPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many UserMemories.
     * @param {UserMemoryCreateManyArgs} args - Arguments to create many UserMemories.
     * @example
     * // Create many UserMemories
     * const userMemory = await prisma.userMemory.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserMemoryCreateManyArgs>(args?: SelectSubset<T, UserMemoryCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many UserMemories and returns the data saved in the database.
     * @param {UserMemoryCreateManyAndReturnArgs} args - Arguments to create many UserMemories.
     * @example
     * // Create many UserMemories
     * const userMemory = await prisma.userMemory.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many UserMemories and only return the `id`
     * const userMemoryWithIdOnly = await prisma.userMemory.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserMemoryCreateManyAndReturnArgs>(args?: SelectSubset<T, UserMemoryCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserMemoryPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a UserMemory.
     * @param {UserMemoryDeleteArgs} args - Arguments to delete one UserMemory.
     * @example
     * // Delete one UserMemory
     * const UserMemory = await prisma.userMemory.delete({
     *   where: {
     *     // ... filter to delete one UserMemory
     *   }
     * })
     * 
     */
    delete<T extends UserMemoryDeleteArgs>(args: SelectSubset<T, UserMemoryDeleteArgs<ExtArgs>>): Prisma__UserMemoryClient<$Result.GetResult<Prisma.$UserMemoryPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one UserMemory.
     * @param {UserMemoryUpdateArgs} args - Arguments to update one UserMemory.
     * @example
     * // Update one UserMemory
     * const userMemory = await prisma.userMemory.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserMemoryUpdateArgs>(args: SelectSubset<T, UserMemoryUpdateArgs<ExtArgs>>): Prisma__UserMemoryClient<$Result.GetResult<Prisma.$UserMemoryPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more UserMemories.
     * @param {UserMemoryDeleteManyArgs} args - Arguments to filter UserMemories to delete.
     * @example
     * // Delete a few UserMemories
     * const { count } = await prisma.userMemory.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserMemoryDeleteManyArgs>(args?: SelectSubset<T, UserMemoryDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more UserMemories.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserMemoryUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many UserMemories
     * const userMemory = await prisma.userMemory.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserMemoryUpdateManyArgs>(args: SelectSubset<T, UserMemoryUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more UserMemories and returns the data updated in the database.
     * @param {UserMemoryUpdateManyAndReturnArgs} args - Arguments to update many UserMemories.
     * @example
     * // Update many UserMemories
     * const userMemory = await prisma.userMemory.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more UserMemories and only return the `id`
     * const userMemoryWithIdOnly = await prisma.userMemory.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends UserMemoryUpdateManyAndReturnArgs>(args: SelectSubset<T, UserMemoryUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserMemoryPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one UserMemory.
     * @param {UserMemoryUpsertArgs} args - Arguments to update or create a UserMemory.
     * @example
     * // Update or create a UserMemory
     * const userMemory = await prisma.userMemory.upsert({
     *   create: {
     *     // ... data to create a UserMemory
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the UserMemory we want to update
     *   }
     * })
     */
    upsert<T extends UserMemoryUpsertArgs>(args: SelectSubset<T, UserMemoryUpsertArgs<ExtArgs>>): Prisma__UserMemoryClient<$Result.GetResult<Prisma.$UserMemoryPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of UserMemories.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserMemoryCountArgs} args - Arguments to filter UserMemories to count.
     * @example
     * // Count the number of UserMemories
     * const count = await prisma.userMemory.count({
     *   where: {
     *     // ... the filter for the UserMemories we want to count
     *   }
     * })
    **/
    count<T extends UserMemoryCountArgs>(
      args?: Subset<T, UserMemoryCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserMemoryCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a UserMemory.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserMemoryAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserMemoryAggregateArgs>(args: Subset<T, UserMemoryAggregateArgs>): Prisma.PrismaPromise<GetUserMemoryAggregateType<T>>

    /**
     * Group by UserMemory.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserMemoryGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserMemoryGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserMemoryGroupByArgs['orderBy'] }
        : { orderBy?: UserMemoryGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserMemoryGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserMemoryGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the UserMemory model
   */
  readonly fields: UserMemoryFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for UserMemory.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserMemoryClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the UserMemory model
   */
  interface UserMemoryFieldRefs {
    readonly id: FieldRef<"UserMemory", 'Int'>
    readonly userId: FieldRef<"UserMemory", 'Int'>
    readonly content: FieldRef<"UserMemory", 'String'>
    readonly category: FieldRef<"UserMemory", 'String'>
    readonly createdAt: FieldRef<"UserMemory", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * UserMemory findUnique
   */
  export type UserMemoryFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserMemory
     */
    select?: UserMemorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserMemory
     */
    omit?: UserMemoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserMemoryInclude<ExtArgs> | null
    /**
     * Filter, which UserMemory to fetch.
     */
    where: UserMemoryWhereUniqueInput
  }

  /**
   * UserMemory findUniqueOrThrow
   */
  export type UserMemoryFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserMemory
     */
    select?: UserMemorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserMemory
     */
    omit?: UserMemoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserMemoryInclude<ExtArgs> | null
    /**
     * Filter, which UserMemory to fetch.
     */
    where: UserMemoryWhereUniqueInput
  }

  /**
   * UserMemory findFirst
   */
  export type UserMemoryFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserMemory
     */
    select?: UserMemorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserMemory
     */
    omit?: UserMemoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserMemoryInclude<ExtArgs> | null
    /**
     * Filter, which UserMemory to fetch.
     */
    where?: UserMemoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserMemories to fetch.
     */
    orderBy?: UserMemoryOrderByWithRelationInput | UserMemoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for UserMemories.
     */
    cursor?: UserMemoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserMemories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserMemories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UserMemories.
     */
    distinct?: UserMemoryScalarFieldEnum | UserMemoryScalarFieldEnum[]
  }

  /**
   * UserMemory findFirstOrThrow
   */
  export type UserMemoryFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserMemory
     */
    select?: UserMemorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserMemory
     */
    omit?: UserMemoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserMemoryInclude<ExtArgs> | null
    /**
     * Filter, which UserMemory to fetch.
     */
    where?: UserMemoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserMemories to fetch.
     */
    orderBy?: UserMemoryOrderByWithRelationInput | UserMemoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for UserMemories.
     */
    cursor?: UserMemoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserMemories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserMemories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UserMemories.
     */
    distinct?: UserMemoryScalarFieldEnum | UserMemoryScalarFieldEnum[]
  }

  /**
   * UserMemory findMany
   */
  export type UserMemoryFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserMemory
     */
    select?: UserMemorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserMemory
     */
    omit?: UserMemoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserMemoryInclude<ExtArgs> | null
    /**
     * Filter, which UserMemories to fetch.
     */
    where?: UserMemoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserMemories to fetch.
     */
    orderBy?: UserMemoryOrderByWithRelationInput | UserMemoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing UserMemories.
     */
    cursor?: UserMemoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserMemories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserMemories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UserMemories.
     */
    distinct?: UserMemoryScalarFieldEnum | UserMemoryScalarFieldEnum[]
  }

  /**
   * UserMemory create
   */
  export type UserMemoryCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserMemory
     */
    select?: UserMemorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserMemory
     */
    omit?: UserMemoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserMemoryInclude<ExtArgs> | null
    /**
     * The data needed to create a UserMemory.
     */
    data: XOR<UserMemoryCreateInput, UserMemoryUncheckedCreateInput>
  }

  /**
   * UserMemory createMany
   */
  export type UserMemoryCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many UserMemories.
     */
    data: UserMemoryCreateManyInput | UserMemoryCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * UserMemory createManyAndReturn
   */
  export type UserMemoryCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserMemory
     */
    select?: UserMemorySelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the UserMemory
     */
    omit?: UserMemoryOmit<ExtArgs> | null
    /**
     * The data used to create many UserMemories.
     */
    data: UserMemoryCreateManyInput | UserMemoryCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserMemoryIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * UserMemory update
   */
  export type UserMemoryUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserMemory
     */
    select?: UserMemorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserMemory
     */
    omit?: UserMemoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserMemoryInclude<ExtArgs> | null
    /**
     * The data needed to update a UserMemory.
     */
    data: XOR<UserMemoryUpdateInput, UserMemoryUncheckedUpdateInput>
    /**
     * Choose, which UserMemory to update.
     */
    where: UserMemoryWhereUniqueInput
  }

  /**
   * UserMemory updateMany
   */
  export type UserMemoryUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update UserMemories.
     */
    data: XOR<UserMemoryUpdateManyMutationInput, UserMemoryUncheckedUpdateManyInput>
    /**
     * Filter which UserMemories to update
     */
    where?: UserMemoryWhereInput
    /**
     * Limit how many UserMemories to update.
     */
    limit?: number
  }

  /**
   * UserMemory updateManyAndReturn
   */
  export type UserMemoryUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserMemory
     */
    select?: UserMemorySelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the UserMemory
     */
    omit?: UserMemoryOmit<ExtArgs> | null
    /**
     * The data used to update UserMemories.
     */
    data: XOR<UserMemoryUpdateManyMutationInput, UserMemoryUncheckedUpdateManyInput>
    /**
     * Filter which UserMemories to update
     */
    where?: UserMemoryWhereInput
    /**
     * Limit how many UserMemories to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserMemoryIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * UserMemory upsert
   */
  export type UserMemoryUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserMemory
     */
    select?: UserMemorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserMemory
     */
    omit?: UserMemoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserMemoryInclude<ExtArgs> | null
    /**
     * The filter to search for the UserMemory to update in case it exists.
     */
    where: UserMemoryWhereUniqueInput
    /**
     * In case the UserMemory found by the `where` argument doesn't exist, create a new UserMemory with this data.
     */
    create: XOR<UserMemoryCreateInput, UserMemoryUncheckedCreateInput>
    /**
     * In case the UserMemory was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserMemoryUpdateInput, UserMemoryUncheckedUpdateInput>
  }

  /**
   * UserMemory delete
   */
  export type UserMemoryDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserMemory
     */
    select?: UserMemorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserMemory
     */
    omit?: UserMemoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserMemoryInclude<ExtArgs> | null
    /**
     * Filter which UserMemory to delete.
     */
    where: UserMemoryWhereUniqueInput
  }

  /**
   * UserMemory deleteMany
   */
  export type UserMemoryDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which UserMemories to delete
     */
    where?: UserMemoryWhereInput
    /**
     * Limit how many UserMemories to delete.
     */
    limit?: number
  }

  /**
   * UserMemory without action
   */
  export type UserMemoryDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserMemory
     */
    select?: UserMemorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserMemory
     */
    omit?: UserMemoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserMemoryInclude<ExtArgs> | null
  }


  /**
   * Model Persona
   */

  export type AggregatePersona = {
    _count: PersonaCountAggregateOutputType | null
    _avg: PersonaAvgAggregateOutputType | null
    _sum: PersonaSumAggregateOutputType | null
    _min: PersonaMinAggregateOutputType | null
    _max: PersonaMaxAggregateOutputType | null
  }

  export type PersonaAvgAggregateOutputType = {
    order: number | null
    createdBy: number | null
  }

  export type PersonaSumAggregateOutputType = {
    order: number | null
    createdBy: number | null
  }

  export type PersonaMinAggregateOutputType = {
    id: string | null
    name: string | null
    jobTitle: string | null
    description: string | null
    systemInstruction: string | null
    identityPrompt: string | null
    iconName: string | null
    colorClass: string | null
    order: number | null
    imageUrl: string | null
    isDefault: boolean | null
    isVisible: boolean | null
    createdBy: number | null
    createdAt: Date | null
  }

  export type PersonaMaxAggregateOutputType = {
    id: string | null
    name: string | null
    jobTitle: string | null
    description: string | null
    systemInstruction: string | null
    identityPrompt: string | null
    iconName: string | null
    colorClass: string | null
    order: number | null
    imageUrl: string | null
    isDefault: boolean | null
    isVisible: boolean | null
    createdBy: number | null
    createdAt: Date | null
  }

  export type PersonaCountAggregateOutputType = {
    id: number
    name: number
    jobTitle: number
    description: number
    systemInstruction: number
    identityPrompt: number
    iconName: number
    colorClass: number
    order: number
    imageUrl: number
    isDefault: number
    isVisible: number
    createdBy: number
    createdAt: number
    _all: number
  }


  export type PersonaAvgAggregateInputType = {
    order?: true
    createdBy?: true
  }

  export type PersonaSumAggregateInputType = {
    order?: true
    createdBy?: true
  }

  export type PersonaMinAggregateInputType = {
    id?: true
    name?: true
    jobTitle?: true
    description?: true
    systemInstruction?: true
    identityPrompt?: true
    iconName?: true
    colorClass?: true
    order?: true
    imageUrl?: true
    isDefault?: true
    isVisible?: true
    createdBy?: true
    createdAt?: true
  }

  export type PersonaMaxAggregateInputType = {
    id?: true
    name?: true
    jobTitle?: true
    description?: true
    systemInstruction?: true
    identityPrompt?: true
    iconName?: true
    colorClass?: true
    order?: true
    imageUrl?: true
    isDefault?: true
    isVisible?: true
    createdBy?: true
    createdAt?: true
  }

  export type PersonaCountAggregateInputType = {
    id?: true
    name?: true
    jobTitle?: true
    description?: true
    systemInstruction?: true
    identityPrompt?: true
    iconName?: true
    colorClass?: true
    order?: true
    imageUrl?: true
    isDefault?: true
    isVisible?: true
    createdBy?: true
    createdAt?: true
    _all?: true
  }

  export type PersonaAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Persona to aggregate.
     */
    where?: PersonaWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Personas to fetch.
     */
    orderBy?: PersonaOrderByWithRelationInput | PersonaOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PersonaWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Personas from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Personas.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Personas
    **/
    _count?: true | PersonaCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: PersonaAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: PersonaSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PersonaMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PersonaMaxAggregateInputType
  }

  export type GetPersonaAggregateType<T extends PersonaAggregateArgs> = {
        [P in keyof T & keyof AggregatePersona]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePersona[P]>
      : GetScalarType<T[P], AggregatePersona[P]>
  }




  export type PersonaGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PersonaWhereInput
    orderBy?: PersonaOrderByWithAggregationInput | PersonaOrderByWithAggregationInput[]
    by: PersonaScalarFieldEnum[] | PersonaScalarFieldEnum
    having?: PersonaScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PersonaCountAggregateInputType | true
    _avg?: PersonaAvgAggregateInputType
    _sum?: PersonaSumAggregateInputType
    _min?: PersonaMinAggregateInputType
    _max?: PersonaMaxAggregateInputType
  }

  export type PersonaGroupByOutputType = {
    id: string
    name: string
    jobTitle: string | null
    description: string | null
    systemInstruction: string
    identityPrompt: string | null
    iconName: string
    colorClass: string
    order: number
    imageUrl: string | null
    isDefault: boolean
    isVisible: boolean
    createdBy: number | null
    createdAt: Date
    _count: PersonaCountAggregateOutputType | null
    _avg: PersonaAvgAggregateOutputType | null
    _sum: PersonaSumAggregateOutputType | null
    _min: PersonaMinAggregateOutputType | null
    _max: PersonaMaxAggregateOutputType | null
  }

  type GetPersonaGroupByPayload<T extends PersonaGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PersonaGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PersonaGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PersonaGroupByOutputType[P]>
            : GetScalarType<T[P], PersonaGroupByOutputType[P]>
        }
      >
    >


  export type PersonaSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    jobTitle?: boolean
    description?: boolean
    systemInstruction?: boolean
    identityPrompt?: boolean
    iconName?: boolean
    colorClass?: boolean
    order?: boolean
    imageUrl?: boolean
    isDefault?: boolean
    isVisible?: boolean
    createdBy?: boolean
    createdAt?: boolean
    user?: boolean | Persona$userArgs<ExtArgs>
    sessions?: boolean | Persona$sessionsArgs<ExtArgs>
    images?: boolean | Persona$imagesArgs<ExtArgs>
    personaXps?: boolean | Persona$personaXpsArgs<ExtArgs>
    _count?: boolean | PersonaCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["persona"]>

  export type PersonaSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    jobTitle?: boolean
    description?: boolean
    systemInstruction?: boolean
    identityPrompt?: boolean
    iconName?: boolean
    colorClass?: boolean
    order?: boolean
    imageUrl?: boolean
    isDefault?: boolean
    isVisible?: boolean
    createdBy?: boolean
    createdAt?: boolean
    user?: boolean | Persona$userArgs<ExtArgs>
  }, ExtArgs["result"]["persona"]>

  export type PersonaSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    jobTitle?: boolean
    description?: boolean
    systemInstruction?: boolean
    identityPrompt?: boolean
    iconName?: boolean
    colorClass?: boolean
    order?: boolean
    imageUrl?: boolean
    isDefault?: boolean
    isVisible?: boolean
    createdBy?: boolean
    createdAt?: boolean
    user?: boolean | Persona$userArgs<ExtArgs>
  }, ExtArgs["result"]["persona"]>

  export type PersonaSelectScalar = {
    id?: boolean
    name?: boolean
    jobTitle?: boolean
    description?: boolean
    systemInstruction?: boolean
    identityPrompt?: boolean
    iconName?: boolean
    colorClass?: boolean
    order?: boolean
    imageUrl?: boolean
    isDefault?: boolean
    isVisible?: boolean
    createdBy?: boolean
    createdAt?: boolean
  }

  export type PersonaOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "jobTitle" | "description" | "systemInstruction" | "identityPrompt" | "iconName" | "colorClass" | "order" | "imageUrl" | "isDefault" | "isVisible" | "createdBy" | "createdAt", ExtArgs["result"]["persona"]>
  export type PersonaInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | Persona$userArgs<ExtArgs>
    sessions?: boolean | Persona$sessionsArgs<ExtArgs>
    images?: boolean | Persona$imagesArgs<ExtArgs>
    personaXps?: boolean | Persona$personaXpsArgs<ExtArgs>
    _count?: boolean | PersonaCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type PersonaIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | Persona$userArgs<ExtArgs>
  }
  export type PersonaIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | Persona$userArgs<ExtArgs>
  }

  export type $PersonaPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Persona"
    objects: {
      user: Prisma.$UserPayload<ExtArgs> | null
      sessions: Prisma.$ChatSessionPayload<ExtArgs>[]
      images: Prisma.$PersonaImagePayload<ExtArgs>[]
      personaXps: Prisma.$UserPersonaXpPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      jobTitle: string | null
      description: string | null
      systemInstruction: string
      identityPrompt: string | null
      iconName: string
      colorClass: string
      order: number
      imageUrl: string | null
      isDefault: boolean
      isVisible: boolean
      createdBy: number | null
      createdAt: Date
    }, ExtArgs["result"]["persona"]>
    composites: {}
  }

  type PersonaGetPayload<S extends boolean | null | undefined | PersonaDefaultArgs> = $Result.GetResult<Prisma.$PersonaPayload, S>

  type PersonaCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PersonaFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PersonaCountAggregateInputType | true
    }

  export interface PersonaDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Persona'], meta: { name: 'Persona' } }
    /**
     * Find zero or one Persona that matches the filter.
     * @param {PersonaFindUniqueArgs} args - Arguments to find a Persona
     * @example
     * // Get one Persona
     * const persona = await prisma.persona.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PersonaFindUniqueArgs>(args: SelectSubset<T, PersonaFindUniqueArgs<ExtArgs>>): Prisma__PersonaClient<$Result.GetResult<Prisma.$PersonaPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Persona that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PersonaFindUniqueOrThrowArgs} args - Arguments to find a Persona
     * @example
     * // Get one Persona
     * const persona = await prisma.persona.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PersonaFindUniqueOrThrowArgs>(args: SelectSubset<T, PersonaFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PersonaClient<$Result.GetResult<Prisma.$PersonaPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Persona that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonaFindFirstArgs} args - Arguments to find a Persona
     * @example
     * // Get one Persona
     * const persona = await prisma.persona.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PersonaFindFirstArgs>(args?: SelectSubset<T, PersonaFindFirstArgs<ExtArgs>>): Prisma__PersonaClient<$Result.GetResult<Prisma.$PersonaPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Persona that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonaFindFirstOrThrowArgs} args - Arguments to find a Persona
     * @example
     * // Get one Persona
     * const persona = await prisma.persona.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PersonaFindFirstOrThrowArgs>(args?: SelectSubset<T, PersonaFindFirstOrThrowArgs<ExtArgs>>): Prisma__PersonaClient<$Result.GetResult<Prisma.$PersonaPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Personas that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonaFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Personas
     * const personas = await prisma.persona.findMany()
     * 
     * // Get first 10 Personas
     * const personas = await prisma.persona.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const personaWithIdOnly = await prisma.persona.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PersonaFindManyArgs>(args?: SelectSubset<T, PersonaFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonaPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Persona.
     * @param {PersonaCreateArgs} args - Arguments to create a Persona.
     * @example
     * // Create one Persona
     * const Persona = await prisma.persona.create({
     *   data: {
     *     // ... data to create a Persona
     *   }
     * })
     * 
     */
    create<T extends PersonaCreateArgs>(args: SelectSubset<T, PersonaCreateArgs<ExtArgs>>): Prisma__PersonaClient<$Result.GetResult<Prisma.$PersonaPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Personas.
     * @param {PersonaCreateManyArgs} args - Arguments to create many Personas.
     * @example
     * // Create many Personas
     * const persona = await prisma.persona.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PersonaCreateManyArgs>(args?: SelectSubset<T, PersonaCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Personas and returns the data saved in the database.
     * @param {PersonaCreateManyAndReturnArgs} args - Arguments to create many Personas.
     * @example
     * // Create many Personas
     * const persona = await prisma.persona.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Personas and only return the `id`
     * const personaWithIdOnly = await prisma.persona.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PersonaCreateManyAndReturnArgs>(args?: SelectSubset<T, PersonaCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonaPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Persona.
     * @param {PersonaDeleteArgs} args - Arguments to delete one Persona.
     * @example
     * // Delete one Persona
     * const Persona = await prisma.persona.delete({
     *   where: {
     *     // ... filter to delete one Persona
     *   }
     * })
     * 
     */
    delete<T extends PersonaDeleteArgs>(args: SelectSubset<T, PersonaDeleteArgs<ExtArgs>>): Prisma__PersonaClient<$Result.GetResult<Prisma.$PersonaPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Persona.
     * @param {PersonaUpdateArgs} args - Arguments to update one Persona.
     * @example
     * // Update one Persona
     * const persona = await prisma.persona.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PersonaUpdateArgs>(args: SelectSubset<T, PersonaUpdateArgs<ExtArgs>>): Prisma__PersonaClient<$Result.GetResult<Prisma.$PersonaPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Personas.
     * @param {PersonaDeleteManyArgs} args - Arguments to filter Personas to delete.
     * @example
     * // Delete a few Personas
     * const { count } = await prisma.persona.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PersonaDeleteManyArgs>(args?: SelectSubset<T, PersonaDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Personas.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonaUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Personas
     * const persona = await prisma.persona.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PersonaUpdateManyArgs>(args: SelectSubset<T, PersonaUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Personas and returns the data updated in the database.
     * @param {PersonaUpdateManyAndReturnArgs} args - Arguments to update many Personas.
     * @example
     * // Update many Personas
     * const persona = await prisma.persona.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Personas and only return the `id`
     * const personaWithIdOnly = await prisma.persona.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends PersonaUpdateManyAndReturnArgs>(args: SelectSubset<T, PersonaUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonaPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Persona.
     * @param {PersonaUpsertArgs} args - Arguments to update or create a Persona.
     * @example
     * // Update or create a Persona
     * const persona = await prisma.persona.upsert({
     *   create: {
     *     // ... data to create a Persona
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Persona we want to update
     *   }
     * })
     */
    upsert<T extends PersonaUpsertArgs>(args: SelectSubset<T, PersonaUpsertArgs<ExtArgs>>): Prisma__PersonaClient<$Result.GetResult<Prisma.$PersonaPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Personas.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonaCountArgs} args - Arguments to filter Personas to count.
     * @example
     * // Count the number of Personas
     * const count = await prisma.persona.count({
     *   where: {
     *     // ... the filter for the Personas we want to count
     *   }
     * })
    **/
    count<T extends PersonaCountArgs>(
      args?: Subset<T, PersonaCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PersonaCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Persona.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonaAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PersonaAggregateArgs>(args: Subset<T, PersonaAggregateArgs>): Prisma.PrismaPromise<GetPersonaAggregateType<T>>

    /**
     * Group by Persona.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonaGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PersonaGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PersonaGroupByArgs['orderBy'] }
        : { orderBy?: PersonaGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PersonaGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPersonaGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Persona model
   */
  readonly fields: PersonaFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Persona.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PersonaClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends Persona$userArgs<ExtArgs> = {}>(args?: Subset<T, Persona$userArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    sessions<T extends Persona$sessionsArgs<ExtArgs> = {}>(args?: Subset<T, Persona$sessionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ChatSessionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    images<T extends Persona$imagesArgs<ExtArgs> = {}>(args?: Subset<T, Persona$imagesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonaImagePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    personaXps<T extends Persona$personaXpsArgs<ExtArgs> = {}>(args?: Subset<T, Persona$personaXpsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPersonaXpPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Persona model
   */
  interface PersonaFieldRefs {
    readonly id: FieldRef<"Persona", 'String'>
    readonly name: FieldRef<"Persona", 'String'>
    readonly jobTitle: FieldRef<"Persona", 'String'>
    readonly description: FieldRef<"Persona", 'String'>
    readonly systemInstruction: FieldRef<"Persona", 'String'>
    readonly identityPrompt: FieldRef<"Persona", 'String'>
    readonly iconName: FieldRef<"Persona", 'String'>
    readonly colorClass: FieldRef<"Persona", 'String'>
    readonly order: FieldRef<"Persona", 'Int'>
    readonly imageUrl: FieldRef<"Persona", 'String'>
    readonly isDefault: FieldRef<"Persona", 'Boolean'>
    readonly isVisible: FieldRef<"Persona", 'Boolean'>
    readonly createdBy: FieldRef<"Persona", 'Int'>
    readonly createdAt: FieldRef<"Persona", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Persona findUnique
   */
  export type PersonaFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Persona
     */
    select?: PersonaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Persona
     */
    omit?: PersonaOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaInclude<ExtArgs> | null
    /**
     * Filter, which Persona to fetch.
     */
    where: PersonaWhereUniqueInput
  }

  /**
   * Persona findUniqueOrThrow
   */
  export type PersonaFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Persona
     */
    select?: PersonaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Persona
     */
    omit?: PersonaOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaInclude<ExtArgs> | null
    /**
     * Filter, which Persona to fetch.
     */
    where: PersonaWhereUniqueInput
  }

  /**
   * Persona findFirst
   */
  export type PersonaFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Persona
     */
    select?: PersonaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Persona
     */
    omit?: PersonaOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaInclude<ExtArgs> | null
    /**
     * Filter, which Persona to fetch.
     */
    where?: PersonaWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Personas to fetch.
     */
    orderBy?: PersonaOrderByWithRelationInput | PersonaOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Personas.
     */
    cursor?: PersonaWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Personas from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Personas.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Personas.
     */
    distinct?: PersonaScalarFieldEnum | PersonaScalarFieldEnum[]
  }

  /**
   * Persona findFirstOrThrow
   */
  export type PersonaFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Persona
     */
    select?: PersonaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Persona
     */
    omit?: PersonaOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaInclude<ExtArgs> | null
    /**
     * Filter, which Persona to fetch.
     */
    where?: PersonaWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Personas to fetch.
     */
    orderBy?: PersonaOrderByWithRelationInput | PersonaOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Personas.
     */
    cursor?: PersonaWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Personas from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Personas.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Personas.
     */
    distinct?: PersonaScalarFieldEnum | PersonaScalarFieldEnum[]
  }

  /**
   * Persona findMany
   */
  export type PersonaFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Persona
     */
    select?: PersonaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Persona
     */
    omit?: PersonaOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaInclude<ExtArgs> | null
    /**
     * Filter, which Personas to fetch.
     */
    where?: PersonaWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Personas to fetch.
     */
    orderBy?: PersonaOrderByWithRelationInput | PersonaOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Personas.
     */
    cursor?: PersonaWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Personas from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Personas.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Personas.
     */
    distinct?: PersonaScalarFieldEnum | PersonaScalarFieldEnum[]
  }

  /**
   * Persona create
   */
  export type PersonaCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Persona
     */
    select?: PersonaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Persona
     */
    omit?: PersonaOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaInclude<ExtArgs> | null
    /**
     * The data needed to create a Persona.
     */
    data: XOR<PersonaCreateInput, PersonaUncheckedCreateInput>
  }

  /**
   * Persona createMany
   */
  export type PersonaCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Personas.
     */
    data: PersonaCreateManyInput | PersonaCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Persona createManyAndReturn
   */
  export type PersonaCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Persona
     */
    select?: PersonaSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Persona
     */
    omit?: PersonaOmit<ExtArgs> | null
    /**
     * The data used to create many Personas.
     */
    data: PersonaCreateManyInput | PersonaCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Persona update
   */
  export type PersonaUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Persona
     */
    select?: PersonaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Persona
     */
    omit?: PersonaOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaInclude<ExtArgs> | null
    /**
     * The data needed to update a Persona.
     */
    data: XOR<PersonaUpdateInput, PersonaUncheckedUpdateInput>
    /**
     * Choose, which Persona to update.
     */
    where: PersonaWhereUniqueInput
  }

  /**
   * Persona updateMany
   */
  export type PersonaUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Personas.
     */
    data: XOR<PersonaUpdateManyMutationInput, PersonaUncheckedUpdateManyInput>
    /**
     * Filter which Personas to update
     */
    where?: PersonaWhereInput
    /**
     * Limit how many Personas to update.
     */
    limit?: number
  }

  /**
   * Persona updateManyAndReturn
   */
  export type PersonaUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Persona
     */
    select?: PersonaSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Persona
     */
    omit?: PersonaOmit<ExtArgs> | null
    /**
     * The data used to update Personas.
     */
    data: XOR<PersonaUpdateManyMutationInput, PersonaUncheckedUpdateManyInput>
    /**
     * Filter which Personas to update
     */
    where?: PersonaWhereInput
    /**
     * Limit how many Personas to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Persona upsert
   */
  export type PersonaUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Persona
     */
    select?: PersonaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Persona
     */
    omit?: PersonaOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaInclude<ExtArgs> | null
    /**
     * The filter to search for the Persona to update in case it exists.
     */
    where: PersonaWhereUniqueInput
    /**
     * In case the Persona found by the `where` argument doesn't exist, create a new Persona with this data.
     */
    create: XOR<PersonaCreateInput, PersonaUncheckedCreateInput>
    /**
     * In case the Persona was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PersonaUpdateInput, PersonaUncheckedUpdateInput>
  }

  /**
   * Persona delete
   */
  export type PersonaDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Persona
     */
    select?: PersonaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Persona
     */
    omit?: PersonaOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaInclude<ExtArgs> | null
    /**
     * Filter which Persona to delete.
     */
    where: PersonaWhereUniqueInput
  }

  /**
   * Persona deleteMany
   */
  export type PersonaDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Personas to delete
     */
    where?: PersonaWhereInput
    /**
     * Limit how many Personas to delete.
     */
    limit?: number
  }

  /**
   * Persona.user
   */
  export type Persona$userArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    where?: UserWhereInput
  }

  /**
   * Persona.sessions
   */
  export type Persona$sessionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ChatSession
     */
    select?: ChatSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ChatSession
     */
    omit?: ChatSessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ChatSessionInclude<ExtArgs> | null
    where?: ChatSessionWhereInput
    orderBy?: ChatSessionOrderByWithRelationInput | ChatSessionOrderByWithRelationInput[]
    cursor?: ChatSessionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ChatSessionScalarFieldEnum | ChatSessionScalarFieldEnum[]
  }

  /**
   * Persona.images
   */
  export type Persona$imagesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaImage
     */
    select?: PersonaImageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonaImage
     */
    omit?: PersonaImageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaImageInclude<ExtArgs> | null
    where?: PersonaImageWhereInput
    orderBy?: PersonaImageOrderByWithRelationInput | PersonaImageOrderByWithRelationInput[]
    cursor?: PersonaImageWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PersonaImageScalarFieldEnum | PersonaImageScalarFieldEnum[]
  }

  /**
   * Persona.personaXps
   */
  export type Persona$personaXpsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserPersonaXp
     */
    select?: UserPersonaXpSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserPersonaXp
     */
    omit?: UserPersonaXpOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPersonaXpInclude<ExtArgs> | null
    where?: UserPersonaXpWhereInput
    orderBy?: UserPersonaXpOrderByWithRelationInput | UserPersonaXpOrderByWithRelationInput[]
    cursor?: UserPersonaXpWhereUniqueInput
    take?: number
    skip?: number
    distinct?: UserPersonaXpScalarFieldEnum | UserPersonaXpScalarFieldEnum[]
  }

  /**
   * Persona without action
   */
  export type PersonaDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Persona
     */
    select?: PersonaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Persona
     */
    omit?: PersonaOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaInclude<ExtArgs> | null
  }


  /**
   * Model PersonaImage
   */

  export type AggregatePersonaImage = {
    _count: PersonaImageCountAggregateOutputType | null
    _avg: PersonaImageAvgAggregateOutputType | null
    _sum: PersonaImageSumAggregateOutputType | null
    _min: PersonaImageMinAggregateOutputType | null
    _max: PersonaImageMaxAggregateOutputType | null
  }

  export type PersonaImageAvgAggregateOutputType = {
    id: number | null
    order: number | null
    requiredLevel: number | null
  }

  export type PersonaImageSumAggregateOutputType = {
    id: number | null
    order: number | null
    requiredLevel: number | null
  }

  export type PersonaImageMinAggregateOutputType = {
    id: number | null
    personaId: string | null
    imageUrl: string | null
    description: string | null
    isMain: boolean | null
    order: number | null
    requiredLevel: number | null
    createdAt: Date | null
  }

  export type PersonaImageMaxAggregateOutputType = {
    id: number | null
    personaId: string | null
    imageUrl: string | null
    description: string | null
    isMain: boolean | null
    order: number | null
    requiredLevel: number | null
    createdAt: Date | null
  }

  export type PersonaImageCountAggregateOutputType = {
    id: number
    personaId: number
    imageUrl: number
    description: number
    isMain: number
    order: number
    requiredLevel: number
    createdAt: number
    _all: number
  }


  export type PersonaImageAvgAggregateInputType = {
    id?: true
    order?: true
    requiredLevel?: true
  }

  export type PersonaImageSumAggregateInputType = {
    id?: true
    order?: true
    requiredLevel?: true
  }

  export type PersonaImageMinAggregateInputType = {
    id?: true
    personaId?: true
    imageUrl?: true
    description?: true
    isMain?: true
    order?: true
    requiredLevel?: true
    createdAt?: true
  }

  export type PersonaImageMaxAggregateInputType = {
    id?: true
    personaId?: true
    imageUrl?: true
    description?: true
    isMain?: true
    order?: true
    requiredLevel?: true
    createdAt?: true
  }

  export type PersonaImageCountAggregateInputType = {
    id?: true
    personaId?: true
    imageUrl?: true
    description?: true
    isMain?: true
    order?: true
    requiredLevel?: true
    createdAt?: true
    _all?: true
  }

  export type PersonaImageAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PersonaImage to aggregate.
     */
    where?: PersonaImageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonaImages to fetch.
     */
    orderBy?: PersonaImageOrderByWithRelationInput | PersonaImageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PersonaImageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonaImages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonaImages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PersonaImages
    **/
    _count?: true | PersonaImageCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: PersonaImageAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: PersonaImageSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PersonaImageMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PersonaImageMaxAggregateInputType
  }

  export type GetPersonaImageAggregateType<T extends PersonaImageAggregateArgs> = {
        [P in keyof T & keyof AggregatePersonaImage]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePersonaImage[P]>
      : GetScalarType<T[P], AggregatePersonaImage[P]>
  }




  export type PersonaImageGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PersonaImageWhereInput
    orderBy?: PersonaImageOrderByWithAggregationInput | PersonaImageOrderByWithAggregationInput[]
    by: PersonaImageScalarFieldEnum[] | PersonaImageScalarFieldEnum
    having?: PersonaImageScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PersonaImageCountAggregateInputType | true
    _avg?: PersonaImageAvgAggregateInputType
    _sum?: PersonaImageSumAggregateInputType
    _min?: PersonaImageMinAggregateInputType
    _max?: PersonaImageMaxAggregateInputType
  }

  export type PersonaImageGroupByOutputType = {
    id: number
    personaId: string
    imageUrl: string
    description: string | null
    isMain: boolean
    order: number
    requiredLevel: number
    createdAt: Date
    _count: PersonaImageCountAggregateOutputType | null
    _avg: PersonaImageAvgAggregateOutputType | null
    _sum: PersonaImageSumAggregateOutputType | null
    _min: PersonaImageMinAggregateOutputType | null
    _max: PersonaImageMaxAggregateOutputType | null
  }

  type GetPersonaImageGroupByPayload<T extends PersonaImageGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PersonaImageGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PersonaImageGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PersonaImageGroupByOutputType[P]>
            : GetScalarType<T[P], PersonaImageGroupByOutputType[P]>
        }
      >
    >


  export type PersonaImageSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    personaId?: boolean
    imageUrl?: boolean
    description?: boolean
    isMain?: boolean
    order?: boolean
    requiredLevel?: boolean
    createdAt?: boolean
    persona?: boolean | PersonaDefaultArgs<ExtArgs>
    videos?: boolean | PersonaImage$videosArgs<ExtArgs>
    _count?: boolean | PersonaImageCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["personaImage"]>

  export type PersonaImageSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    personaId?: boolean
    imageUrl?: boolean
    description?: boolean
    isMain?: boolean
    order?: boolean
    requiredLevel?: boolean
    createdAt?: boolean
    persona?: boolean | PersonaDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["personaImage"]>

  export type PersonaImageSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    personaId?: boolean
    imageUrl?: boolean
    description?: boolean
    isMain?: boolean
    order?: boolean
    requiredLevel?: boolean
    createdAt?: boolean
    persona?: boolean | PersonaDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["personaImage"]>

  export type PersonaImageSelectScalar = {
    id?: boolean
    personaId?: boolean
    imageUrl?: boolean
    description?: boolean
    isMain?: boolean
    order?: boolean
    requiredLevel?: boolean
    createdAt?: boolean
  }

  export type PersonaImageOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "personaId" | "imageUrl" | "description" | "isMain" | "order" | "requiredLevel" | "createdAt", ExtArgs["result"]["personaImage"]>
  export type PersonaImageInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    persona?: boolean | PersonaDefaultArgs<ExtArgs>
    videos?: boolean | PersonaImage$videosArgs<ExtArgs>
    _count?: boolean | PersonaImageCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type PersonaImageIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    persona?: boolean | PersonaDefaultArgs<ExtArgs>
  }
  export type PersonaImageIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    persona?: boolean | PersonaDefaultArgs<ExtArgs>
  }

  export type $PersonaImagePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PersonaImage"
    objects: {
      persona: Prisma.$PersonaPayload<ExtArgs>
      videos: Prisma.$PersonaVideoPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      personaId: string
      imageUrl: string
      description: string | null
      isMain: boolean
      order: number
      requiredLevel: number
      createdAt: Date
    }, ExtArgs["result"]["personaImage"]>
    composites: {}
  }

  type PersonaImageGetPayload<S extends boolean | null | undefined | PersonaImageDefaultArgs> = $Result.GetResult<Prisma.$PersonaImagePayload, S>

  type PersonaImageCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PersonaImageFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PersonaImageCountAggregateInputType | true
    }

  export interface PersonaImageDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PersonaImage'], meta: { name: 'PersonaImage' } }
    /**
     * Find zero or one PersonaImage that matches the filter.
     * @param {PersonaImageFindUniqueArgs} args - Arguments to find a PersonaImage
     * @example
     * // Get one PersonaImage
     * const personaImage = await prisma.personaImage.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PersonaImageFindUniqueArgs>(args: SelectSubset<T, PersonaImageFindUniqueArgs<ExtArgs>>): Prisma__PersonaImageClient<$Result.GetResult<Prisma.$PersonaImagePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one PersonaImage that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PersonaImageFindUniqueOrThrowArgs} args - Arguments to find a PersonaImage
     * @example
     * // Get one PersonaImage
     * const personaImage = await prisma.personaImage.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PersonaImageFindUniqueOrThrowArgs>(args: SelectSubset<T, PersonaImageFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PersonaImageClient<$Result.GetResult<Prisma.$PersonaImagePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PersonaImage that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonaImageFindFirstArgs} args - Arguments to find a PersonaImage
     * @example
     * // Get one PersonaImage
     * const personaImage = await prisma.personaImage.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PersonaImageFindFirstArgs>(args?: SelectSubset<T, PersonaImageFindFirstArgs<ExtArgs>>): Prisma__PersonaImageClient<$Result.GetResult<Prisma.$PersonaImagePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PersonaImage that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonaImageFindFirstOrThrowArgs} args - Arguments to find a PersonaImage
     * @example
     * // Get one PersonaImage
     * const personaImage = await prisma.personaImage.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PersonaImageFindFirstOrThrowArgs>(args?: SelectSubset<T, PersonaImageFindFirstOrThrowArgs<ExtArgs>>): Prisma__PersonaImageClient<$Result.GetResult<Prisma.$PersonaImagePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more PersonaImages that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonaImageFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PersonaImages
     * const personaImages = await prisma.personaImage.findMany()
     * 
     * // Get first 10 PersonaImages
     * const personaImages = await prisma.personaImage.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const personaImageWithIdOnly = await prisma.personaImage.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PersonaImageFindManyArgs>(args?: SelectSubset<T, PersonaImageFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonaImagePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a PersonaImage.
     * @param {PersonaImageCreateArgs} args - Arguments to create a PersonaImage.
     * @example
     * // Create one PersonaImage
     * const PersonaImage = await prisma.personaImage.create({
     *   data: {
     *     // ... data to create a PersonaImage
     *   }
     * })
     * 
     */
    create<T extends PersonaImageCreateArgs>(args: SelectSubset<T, PersonaImageCreateArgs<ExtArgs>>): Prisma__PersonaImageClient<$Result.GetResult<Prisma.$PersonaImagePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many PersonaImages.
     * @param {PersonaImageCreateManyArgs} args - Arguments to create many PersonaImages.
     * @example
     * // Create many PersonaImages
     * const personaImage = await prisma.personaImage.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PersonaImageCreateManyArgs>(args?: SelectSubset<T, PersonaImageCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PersonaImages and returns the data saved in the database.
     * @param {PersonaImageCreateManyAndReturnArgs} args - Arguments to create many PersonaImages.
     * @example
     * // Create many PersonaImages
     * const personaImage = await prisma.personaImage.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PersonaImages and only return the `id`
     * const personaImageWithIdOnly = await prisma.personaImage.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PersonaImageCreateManyAndReturnArgs>(args?: SelectSubset<T, PersonaImageCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonaImagePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a PersonaImage.
     * @param {PersonaImageDeleteArgs} args - Arguments to delete one PersonaImage.
     * @example
     * // Delete one PersonaImage
     * const PersonaImage = await prisma.personaImage.delete({
     *   where: {
     *     // ... filter to delete one PersonaImage
     *   }
     * })
     * 
     */
    delete<T extends PersonaImageDeleteArgs>(args: SelectSubset<T, PersonaImageDeleteArgs<ExtArgs>>): Prisma__PersonaImageClient<$Result.GetResult<Prisma.$PersonaImagePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one PersonaImage.
     * @param {PersonaImageUpdateArgs} args - Arguments to update one PersonaImage.
     * @example
     * // Update one PersonaImage
     * const personaImage = await prisma.personaImage.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PersonaImageUpdateArgs>(args: SelectSubset<T, PersonaImageUpdateArgs<ExtArgs>>): Prisma__PersonaImageClient<$Result.GetResult<Prisma.$PersonaImagePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more PersonaImages.
     * @param {PersonaImageDeleteManyArgs} args - Arguments to filter PersonaImages to delete.
     * @example
     * // Delete a few PersonaImages
     * const { count } = await prisma.personaImage.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PersonaImageDeleteManyArgs>(args?: SelectSubset<T, PersonaImageDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PersonaImages.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonaImageUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PersonaImages
     * const personaImage = await prisma.personaImage.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PersonaImageUpdateManyArgs>(args: SelectSubset<T, PersonaImageUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PersonaImages and returns the data updated in the database.
     * @param {PersonaImageUpdateManyAndReturnArgs} args - Arguments to update many PersonaImages.
     * @example
     * // Update many PersonaImages
     * const personaImage = await prisma.personaImage.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more PersonaImages and only return the `id`
     * const personaImageWithIdOnly = await prisma.personaImage.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends PersonaImageUpdateManyAndReturnArgs>(args: SelectSubset<T, PersonaImageUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonaImagePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one PersonaImage.
     * @param {PersonaImageUpsertArgs} args - Arguments to update or create a PersonaImage.
     * @example
     * // Update or create a PersonaImage
     * const personaImage = await prisma.personaImage.upsert({
     *   create: {
     *     // ... data to create a PersonaImage
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PersonaImage we want to update
     *   }
     * })
     */
    upsert<T extends PersonaImageUpsertArgs>(args: SelectSubset<T, PersonaImageUpsertArgs<ExtArgs>>): Prisma__PersonaImageClient<$Result.GetResult<Prisma.$PersonaImagePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of PersonaImages.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonaImageCountArgs} args - Arguments to filter PersonaImages to count.
     * @example
     * // Count the number of PersonaImages
     * const count = await prisma.personaImage.count({
     *   where: {
     *     // ... the filter for the PersonaImages we want to count
     *   }
     * })
    **/
    count<T extends PersonaImageCountArgs>(
      args?: Subset<T, PersonaImageCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PersonaImageCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PersonaImage.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonaImageAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PersonaImageAggregateArgs>(args: Subset<T, PersonaImageAggregateArgs>): Prisma.PrismaPromise<GetPersonaImageAggregateType<T>>

    /**
     * Group by PersonaImage.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonaImageGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PersonaImageGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PersonaImageGroupByArgs['orderBy'] }
        : { orderBy?: PersonaImageGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PersonaImageGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPersonaImageGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PersonaImage model
   */
  readonly fields: PersonaImageFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PersonaImage.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PersonaImageClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    persona<T extends PersonaDefaultArgs<ExtArgs> = {}>(args?: Subset<T, PersonaDefaultArgs<ExtArgs>>): Prisma__PersonaClient<$Result.GetResult<Prisma.$PersonaPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    videos<T extends PersonaImage$videosArgs<ExtArgs> = {}>(args?: Subset<T, PersonaImage$videosArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonaVideoPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PersonaImage model
   */
  interface PersonaImageFieldRefs {
    readonly id: FieldRef<"PersonaImage", 'Int'>
    readonly personaId: FieldRef<"PersonaImage", 'String'>
    readonly imageUrl: FieldRef<"PersonaImage", 'String'>
    readonly description: FieldRef<"PersonaImage", 'String'>
    readonly isMain: FieldRef<"PersonaImage", 'Boolean'>
    readonly order: FieldRef<"PersonaImage", 'Int'>
    readonly requiredLevel: FieldRef<"PersonaImage", 'Int'>
    readonly createdAt: FieldRef<"PersonaImage", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PersonaImage findUnique
   */
  export type PersonaImageFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaImage
     */
    select?: PersonaImageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonaImage
     */
    omit?: PersonaImageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaImageInclude<ExtArgs> | null
    /**
     * Filter, which PersonaImage to fetch.
     */
    where: PersonaImageWhereUniqueInput
  }

  /**
   * PersonaImage findUniqueOrThrow
   */
  export type PersonaImageFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaImage
     */
    select?: PersonaImageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonaImage
     */
    omit?: PersonaImageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaImageInclude<ExtArgs> | null
    /**
     * Filter, which PersonaImage to fetch.
     */
    where: PersonaImageWhereUniqueInput
  }

  /**
   * PersonaImage findFirst
   */
  export type PersonaImageFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaImage
     */
    select?: PersonaImageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonaImage
     */
    omit?: PersonaImageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaImageInclude<ExtArgs> | null
    /**
     * Filter, which PersonaImage to fetch.
     */
    where?: PersonaImageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonaImages to fetch.
     */
    orderBy?: PersonaImageOrderByWithRelationInput | PersonaImageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PersonaImages.
     */
    cursor?: PersonaImageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonaImages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonaImages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PersonaImages.
     */
    distinct?: PersonaImageScalarFieldEnum | PersonaImageScalarFieldEnum[]
  }

  /**
   * PersonaImage findFirstOrThrow
   */
  export type PersonaImageFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaImage
     */
    select?: PersonaImageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonaImage
     */
    omit?: PersonaImageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaImageInclude<ExtArgs> | null
    /**
     * Filter, which PersonaImage to fetch.
     */
    where?: PersonaImageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonaImages to fetch.
     */
    orderBy?: PersonaImageOrderByWithRelationInput | PersonaImageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PersonaImages.
     */
    cursor?: PersonaImageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonaImages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonaImages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PersonaImages.
     */
    distinct?: PersonaImageScalarFieldEnum | PersonaImageScalarFieldEnum[]
  }

  /**
   * PersonaImage findMany
   */
  export type PersonaImageFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaImage
     */
    select?: PersonaImageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonaImage
     */
    omit?: PersonaImageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaImageInclude<ExtArgs> | null
    /**
     * Filter, which PersonaImages to fetch.
     */
    where?: PersonaImageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonaImages to fetch.
     */
    orderBy?: PersonaImageOrderByWithRelationInput | PersonaImageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PersonaImages.
     */
    cursor?: PersonaImageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonaImages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonaImages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PersonaImages.
     */
    distinct?: PersonaImageScalarFieldEnum | PersonaImageScalarFieldEnum[]
  }

  /**
   * PersonaImage create
   */
  export type PersonaImageCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaImage
     */
    select?: PersonaImageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonaImage
     */
    omit?: PersonaImageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaImageInclude<ExtArgs> | null
    /**
     * The data needed to create a PersonaImage.
     */
    data: XOR<PersonaImageCreateInput, PersonaImageUncheckedCreateInput>
  }

  /**
   * PersonaImage createMany
   */
  export type PersonaImageCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PersonaImages.
     */
    data: PersonaImageCreateManyInput | PersonaImageCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PersonaImage createManyAndReturn
   */
  export type PersonaImageCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaImage
     */
    select?: PersonaImageSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PersonaImage
     */
    omit?: PersonaImageOmit<ExtArgs> | null
    /**
     * The data used to create many PersonaImages.
     */
    data: PersonaImageCreateManyInput | PersonaImageCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaImageIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * PersonaImage update
   */
  export type PersonaImageUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaImage
     */
    select?: PersonaImageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonaImage
     */
    omit?: PersonaImageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaImageInclude<ExtArgs> | null
    /**
     * The data needed to update a PersonaImage.
     */
    data: XOR<PersonaImageUpdateInput, PersonaImageUncheckedUpdateInput>
    /**
     * Choose, which PersonaImage to update.
     */
    where: PersonaImageWhereUniqueInput
  }

  /**
   * PersonaImage updateMany
   */
  export type PersonaImageUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PersonaImages.
     */
    data: XOR<PersonaImageUpdateManyMutationInput, PersonaImageUncheckedUpdateManyInput>
    /**
     * Filter which PersonaImages to update
     */
    where?: PersonaImageWhereInput
    /**
     * Limit how many PersonaImages to update.
     */
    limit?: number
  }

  /**
   * PersonaImage updateManyAndReturn
   */
  export type PersonaImageUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaImage
     */
    select?: PersonaImageSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PersonaImage
     */
    omit?: PersonaImageOmit<ExtArgs> | null
    /**
     * The data used to update PersonaImages.
     */
    data: XOR<PersonaImageUpdateManyMutationInput, PersonaImageUncheckedUpdateManyInput>
    /**
     * Filter which PersonaImages to update
     */
    where?: PersonaImageWhereInput
    /**
     * Limit how many PersonaImages to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaImageIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * PersonaImage upsert
   */
  export type PersonaImageUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaImage
     */
    select?: PersonaImageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonaImage
     */
    omit?: PersonaImageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaImageInclude<ExtArgs> | null
    /**
     * The filter to search for the PersonaImage to update in case it exists.
     */
    where: PersonaImageWhereUniqueInput
    /**
     * In case the PersonaImage found by the `where` argument doesn't exist, create a new PersonaImage with this data.
     */
    create: XOR<PersonaImageCreateInput, PersonaImageUncheckedCreateInput>
    /**
     * In case the PersonaImage was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PersonaImageUpdateInput, PersonaImageUncheckedUpdateInput>
  }

  /**
   * PersonaImage delete
   */
  export type PersonaImageDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaImage
     */
    select?: PersonaImageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonaImage
     */
    omit?: PersonaImageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaImageInclude<ExtArgs> | null
    /**
     * Filter which PersonaImage to delete.
     */
    where: PersonaImageWhereUniqueInput
  }

  /**
   * PersonaImage deleteMany
   */
  export type PersonaImageDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PersonaImages to delete
     */
    where?: PersonaImageWhereInput
    /**
     * Limit how many PersonaImages to delete.
     */
    limit?: number
  }

  /**
   * PersonaImage.videos
   */
  export type PersonaImage$videosArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaVideo
     */
    select?: PersonaVideoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonaVideo
     */
    omit?: PersonaVideoOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaVideoInclude<ExtArgs> | null
    where?: PersonaVideoWhereInput
    orderBy?: PersonaVideoOrderByWithRelationInput | PersonaVideoOrderByWithRelationInput[]
    cursor?: PersonaVideoWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PersonaVideoScalarFieldEnum | PersonaVideoScalarFieldEnum[]
  }

  /**
   * PersonaImage without action
   */
  export type PersonaImageDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaImage
     */
    select?: PersonaImageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonaImage
     */
    omit?: PersonaImageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaImageInclude<ExtArgs> | null
  }


  /**
   * Model PersonaVideo
   */

  export type AggregatePersonaVideo = {
    _count: PersonaVideoCountAggregateOutputType | null
    _avg: PersonaVideoAvgAggregateOutputType | null
    _sum: PersonaVideoSumAggregateOutputType | null
    _min: PersonaVideoMinAggregateOutputType | null
    _max: PersonaVideoMaxAggregateOutputType | null
  }

  export type PersonaVideoAvgAggregateOutputType = {
    id: number | null
    imageId: number | null
    order: number | null
    requiredLevel: number | null
  }

  export type PersonaVideoSumAggregateOutputType = {
    id: number | null
    imageId: number | null
    order: number | null
    requiredLevel: number | null
  }

  export type PersonaVideoMinAggregateOutputType = {
    id: number | null
    imageId: number | null
    videoUrl: string | null
    title: string | null
    order: number | null
    requiredLevel: number | null
    createdAt: Date | null
  }

  export type PersonaVideoMaxAggregateOutputType = {
    id: number | null
    imageId: number | null
    videoUrl: string | null
    title: string | null
    order: number | null
    requiredLevel: number | null
    createdAt: Date | null
  }

  export type PersonaVideoCountAggregateOutputType = {
    id: number
    imageId: number
    videoUrl: number
    title: number
    order: number
    requiredLevel: number
    createdAt: number
    _all: number
  }


  export type PersonaVideoAvgAggregateInputType = {
    id?: true
    imageId?: true
    order?: true
    requiredLevel?: true
  }

  export type PersonaVideoSumAggregateInputType = {
    id?: true
    imageId?: true
    order?: true
    requiredLevel?: true
  }

  export type PersonaVideoMinAggregateInputType = {
    id?: true
    imageId?: true
    videoUrl?: true
    title?: true
    order?: true
    requiredLevel?: true
    createdAt?: true
  }

  export type PersonaVideoMaxAggregateInputType = {
    id?: true
    imageId?: true
    videoUrl?: true
    title?: true
    order?: true
    requiredLevel?: true
    createdAt?: true
  }

  export type PersonaVideoCountAggregateInputType = {
    id?: true
    imageId?: true
    videoUrl?: true
    title?: true
    order?: true
    requiredLevel?: true
    createdAt?: true
    _all?: true
  }

  export type PersonaVideoAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PersonaVideo to aggregate.
     */
    where?: PersonaVideoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonaVideos to fetch.
     */
    orderBy?: PersonaVideoOrderByWithRelationInput | PersonaVideoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PersonaVideoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonaVideos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonaVideos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PersonaVideos
    **/
    _count?: true | PersonaVideoCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: PersonaVideoAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: PersonaVideoSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PersonaVideoMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PersonaVideoMaxAggregateInputType
  }

  export type GetPersonaVideoAggregateType<T extends PersonaVideoAggregateArgs> = {
        [P in keyof T & keyof AggregatePersonaVideo]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePersonaVideo[P]>
      : GetScalarType<T[P], AggregatePersonaVideo[P]>
  }




  export type PersonaVideoGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PersonaVideoWhereInput
    orderBy?: PersonaVideoOrderByWithAggregationInput | PersonaVideoOrderByWithAggregationInput[]
    by: PersonaVideoScalarFieldEnum[] | PersonaVideoScalarFieldEnum
    having?: PersonaVideoScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PersonaVideoCountAggregateInputType | true
    _avg?: PersonaVideoAvgAggregateInputType
    _sum?: PersonaVideoSumAggregateInputType
    _min?: PersonaVideoMinAggregateInputType
    _max?: PersonaVideoMaxAggregateInputType
  }

  export type PersonaVideoGroupByOutputType = {
    id: number
    imageId: number
    videoUrl: string
    title: string | null
    order: number
    requiredLevel: number
    createdAt: Date
    _count: PersonaVideoCountAggregateOutputType | null
    _avg: PersonaVideoAvgAggregateOutputType | null
    _sum: PersonaVideoSumAggregateOutputType | null
    _min: PersonaVideoMinAggregateOutputType | null
    _max: PersonaVideoMaxAggregateOutputType | null
  }

  type GetPersonaVideoGroupByPayload<T extends PersonaVideoGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PersonaVideoGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PersonaVideoGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PersonaVideoGroupByOutputType[P]>
            : GetScalarType<T[P], PersonaVideoGroupByOutputType[P]>
        }
      >
    >


  export type PersonaVideoSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    imageId?: boolean
    videoUrl?: boolean
    title?: boolean
    order?: boolean
    requiredLevel?: boolean
    createdAt?: boolean
    image?: boolean | PersonaImageDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["personaVideo"]>

  export type PersonaVideoSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    imageId?: boolean
    videoUrl?: boolean
    title?: boolean
    order?: boolean
    requiredLevel?: boolean
    createdAt?: boolean
    image?: boolean | PersonaImageDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["personaVideo"]>

  export type PersonaVideoSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    imageId?: boolean
    videoUrl?: boolean
    title?: boolean
    order?: boolean
    requiredLevel?: boolean
    createdAt?: boolean
    image?: boolean | PersonaImageDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["personaVideo"]>

  export type PersonaVideoSelectScalar = {
    id?: boolean
    imageId?: boolean
    videoUrl?: boolean
    title?: boolean
    order?: boolean
    requiredLevel?: boolean
    createdAt?: boolean
  }

  export type PersonaVideoOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "imageId" | "videoUrl" | "title" | "order" | "requiredLevel" | "createdAt", ExtArgs["result"]["personaVideo"]>
  export type PersonaVideoInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    image?: boolean | PersonaImageDefaultArgs<ExtArgs>
  }
  export type PersonaVideoIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    image?: boolean | PersonaImageDefaultArgs<ExtArgs>
  }
  export type PersonaVideoIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    image?: boolean | PersonaImageDefaultArgs<ExtArgs>
  }

  export type $PersonaVideoPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PersonaVideo"
    objects: {
      image: Prisma.$PersonaImagePayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      imageId: number
      videoUrl: string
      title: string | null
      order: number
      requiredLevel: number
      createdAt: Date
    }, ExtArgs["result"]["personaVideo"]>
    composites: {}
  }

  type PersonaVideoGetPayload<S extends boolean | null | undefined | PersonaVideoDefaultArgs> = $Result.GetResult<Prisma.$PersonaVideoPayload, S>

  type PersonaVideoCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PersonaVideoFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PersonaVideoCountAggregateInputType | true
    }

  export interface PersonaVideoDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PersonaVideo'], meta: { name: 'PersonaVideo' } }
    /**
     * Find zero or one PersonaVideo that matches the filter.
     * @param {PersonaVideoFindUniqueArgs} args - Arguments to find a PersonaVideo
     * @example
     * // Get one PersonaVideo
     * const personaVideo = await prisma.personaVideo.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PersonaVideoFindUniqueArgs>(args: SelectSubset<T, PersonaVideoFindUniqueArgs<ExtArgs>>): Prisma__PersonaVideoClient<$Result.GetResult<Prisma.$PersonaVideoPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one PersonaVideo that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PersonaVideoFindUniqueOrThrowArgs} args - Arguments to find a PersonaVideo
     * @example
     * // Get one PersonaVideo
     * const personaVideo = await prisma.personaVideo.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PersonaVideoFindUniqueOrThrowArgs>(args: SelectSubset<T, PersonaVideoFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PersonaVideoClient<$Result.GetResult<Prisma.$PersonaVideoPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PersonaVideo that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonaVideoFindFirstArgs} args - Arguments to find a PersonaVideo
     * @example
     * // Get one PersonaVideo
     * const personaVideo = await prisma.personaVideo.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PersonaVideoFindFirstArgs>(args?: SelectSubset<T, PersonaVideoFindFirstArgs<ExtArgs>>): Prisma__PersonaVideoClient<$Result.GetResult<Prisma.$PersonaVideoPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PersonaVideo that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonaVideoFindFirstOrThrowArgs} args - Arguments to find a PersonaVideo
     * @example
     * // Get one PersonaVideo
     * const personaVideo = await prisma.personaVideo.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PersonaVideoFindFirstOrThrowArgs>(args?: SelectSubset<T, PersonaVideoFindFirstOrThrowArgs<ExtArgs>>): Prisma__PersonaVideoClient<$Result.GetResult<Prisma.$PersonaVideoPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more PersonaVideos that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonaVideoFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PersonaVideos
     * const personaVideos = await prisma.personaVideo.findMany()
     * 
     * // Get first 10 PersonaVideos
     * const personaVideos = await prisma.personaVideo.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const personaVideoWithIdOnly = await prisma.personaVideo.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PersonaVideoFindManyArgs>(args?: SelectSubset<T, PersonaVideoFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonaVideoPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a PersonaVideo.
     * @param {PersonaVideoCreateArgs} args - Arguments to create a PersonaVideo.
     * @example
     * // Create one PersonaVideo
     * const PersonaVideo = await prisma.personaVideo.create({
     *   data: {
     *     // ... data to create a PersonaVideo
     *   }
     * })
     * 
     */
    create<T extends PersonaVideoCreateArgs>(args: SelectSubset<T, PersonaVideoCreateArgs<ExtArgs>>): Prisma__PersonaVideoClient<$Result.GetResult<Prisma.$PersonaVideoPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many PersonaVideos.
     * @param {PersonaVideoCreateManyArgs} args - Arguments to create many PersonaVideos.
     * @example
     * // Create many PersonaVideos
     * const personaVideo = await prisma.personaVideo.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PersonaVideoCreateManyArgs>(args?: SelectSubset<T, PersonaVideoCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PersonaVideos and returns the data saved in the database.
     * @param {PersonaVideoCreateManyAndReturnArgs} args - Arguments to create many PersonaVideos.
     * @example
     * // Create many PersonaVideos
     * const personaVideo = await prisma.personaVideo.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PersonaVideos and only return the `id`
     * const personaVideoWithIdOnly = await prisma.personaVideo.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PersonaVideoCreateManyAndReturnArgs>(args?: SelectSubset<T, PersonaVideoCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonaVideoPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a PersonaVideo.
     * @param {PersonaVideoDeleteArgs} args - Arguments to delete one PersonaVideo.
     * @example
     * // Delete one PersonaVideo
     * const PersonaVideo = await prisma.personaVideo.delete({
     *   where: {
     *     // ... filter to delete one PersonaVideo
     *   }
     * })
     * 
     */
    delete<T extends PersonaVideoDeleteArgs>(args: SelectSubset<T, PersonaVideoDeleteArgs<ExtArgs>>): Prisma__PersonaVideoClient<$Result.GetResult<Prisma.$PersonaVideoPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one PersonaVideo.
     * @param {PersonaVideoUpdateArgs} args - Arguments to update one PersonaVideo.
     * @example
     * // Update one PersonaVideo
     * const personaVideo = await prisma.personaVideo.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PersonaVideoUpdateArgs>(args: SelectSubset<T, PersonaVideoUpdateArgs<ExtArgs>>): Prisma__PersonaVideoClient<$Result.GetResult<Prisma.$PersonaVideoPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more PersonaVideos.
     * @param {PersonaVideoDeleteManyArgs} args - Arguments to filter PersonaVideos to delete.
     * @example
     * // Delete a few PersonaVideos
     * const { count } = await prisma.personaVideo.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PersonaVideoDeleteManyArgs>(args?: SelectSubset<T, PersonaVideoDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PersonaVideos.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonaVideoUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PersonaVideos
     * const personaVideo = await prisma.personaVideo.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PersonaVideoUpdateManyArgs>(args: SelectSubset<T, PersonaVideoUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PersonaVideos and returns the data updated in the database.
     * @param {PersonaVideoUpdateManyAndReturnArgs} args - Arguments to update many PersonaVideos.
     * @example
     * // Update many PersonaVideos
     * const personaVideo = await prisma.personaVideo.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more PersonaVideos and only return the `id`
     * const personaVideoWithIdOnly = await prisma.personaVideo.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends PersonaVideoUpdateManyAndReturnArgs>(args: SelectSubset<T, PersonaVideoUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PersonaVideoPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one PersonaVideo.
     * @param {PersonaVideoUpsertArgs} args - Arguments to update or create a PersonaVideo.
     * @example
     * // Update or create a PersonaVideo
     * const personaVideo = await prisma.personaVideo.upsert({
     *   create: {
     *     // ... data to create a PersonaVideo
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PersonaVideo we want to update
     *   }
     * })
     */
    upsert<T extends PersonaVideoUpsertArgs>(args: SelectSubset<T, PersonaVideoUpsertArgs<ExtArgs>>): Prisma__PersonaVideoClient<$Result.GetResult<Prisma.$PersonaVideoPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of PersonaVideos.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonaVideoCountArgs} args - Arguments to filter PersonaVideos to count.
     * @example
     * // Count the number of PersonaVideos
     * const count = await prisma.personaVideo.count({
     *   where: {
     *     // ... the filter for the PersonaVideos we want to count
     *   }
     * })
    **/
    count<T extends PersonaVideoCountArgs>(
      args?: Subset<T, PersonaVideoCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PersonaVideoCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PersonaVideo.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonaVideoAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PersonaVideoAggregateArgs>(args: Subset<T, PersonaVideoAggregateArgs>): Prisma.PrismaPromise<GetPersonaVideoAggregateType<T>>

    /**
     * Group by PersonaVideo.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PersonaVideoGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PersonaVideoGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PersonaVideoGroupByArgs['orderBy'] }
        : { orderBy?: PersonaVideoGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PersonaVideoGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPersonaVideoGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PersonaVideo model
   */
  readonly fields: PersonaVideoFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PersonaVideo.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PersonaVideoClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    image<T extends PersonaImageDefaultArgs<ExtArgs> = {}>(args?: Subset<T, PersonaImageDefaultArgs<ExtArgs>>): Prisma__PersonaImageClient<$Result.GetResult<Prisma.$PersonaImagePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PersonaVideo model
   */
  interface PersonaVideoFieldRefs {
    readonly id: FieldRef<"PersonaVideo", 'Int'>
    readonly imageId: FieldRef<"PersonaVideo", 'Int'>
    readonly videoUrl: FieldRef<"PersonaVideo", 'String'>
    readonly title: FieldRef<"PersonaVideo", 'String'>
    readonly order: FieldRef<"PersonaVideo", 'Int'>
    readonly requiredLevel: FieldRef<"PersonaVideo", 'Int'>
    readonly createdAt: FieldRef<"PersonaVideo", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PersonaVideo findUnique
   */
  export type PersonaVideoFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaVideo
     */
    select?: PersonaVideoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonaVideo
     */
    omit?: PersonaVideoOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaVideoInclude<ExtArgs> | null
    /**
     * Filter, which PersonaVideo to fetch.
     */
    where: PersonaVideoWhereUniqueInput
  }

  /**
   * PersonaVideo findUniqueOrThrow
   */
  export type PersonaVideoFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaVideo
     */
    select?: PersonaVideoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonaVideo
     */
    omit?: PersonaVideoOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaVideoInclude<ExtArgs> | null
    /**
     * Filter, which PersonaVideo to fetch.
     */
    where: PersonaVideoWhereUniqueInput
  }

  /**
   * PersonaVideo findFirst
   */
  export type PersonaVideoFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaVideo
     */
    select?: PersonaVideoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonaVideo
     */
    omit?: PersonaVideoOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaVideoInclude<ExtArgs> | null
    /**
     * Filter, which PersonaVideo to fetch.
     */
    where?: PersonaVideoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonaVideos to fetch.
     */
    orderBy?: PersonaVideoOrderByWithRelationInput | PersonaVideoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PersonaVideos.
     */
    cursor?: PersonaVideoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonaVideos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonaVideos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PersonaVideos.
     */
    distinct?: PersonaVideoScalarFieldEnum | PersonaVideoScalarFieldEnum[]
  }

  /**
   * PersonaVideo findFirstOrThrow
   */
  export type PersonaVideoFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaVideo
     */
    select?: PersonaVideoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonaVideo
     */
    omit?: PersonaVideoOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaVideoInclude<ExtArgs> | null
    /**
     * Filter, which PersonaVideo to fetch.
     */
    where?: PersonaVideoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonaVideos to fetch.
     */
    orderBy?: PersonaVideoOrderByWithRelationInput | PersonaVideoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PersonaVideos.
     */
    cursor?: PersonaVideoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonaVideos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonaVideos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PersonaVideos.
     */
    distinct?: PersonaVideoScalarFieldEnum | PersonaVideoScalarFieldEnum[]
  }

  /**
   * PersonaVideo findMany
   */
  export type PersonaVideoFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaVideo
     */
    select?: PersonaVideoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonaVideo
     */
    omit?: PersonaVideoOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaVideoInclude<ExtArgs> | null
    /**
     * Filter, which PersonaVideos to fetch.
     */
    where?: PersonaVideoWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PersonaVideos to fetch.
     */
    orderBy?: PersonaVideoOrderByWithRelationInput | PersonaVideoOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PersonaVideos.
     */
    cursor?: PersonaVideoWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PersonaVideos from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PersonaVideos.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PersonaVideos.
     */
    distinct?: PersonaVideoScalarFieldEnum | PersonaVideoScalarFieldEnum[]
  }

  /**
   * PersonaVideo create
   */
  export type PersonaVideoCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaVideo
     */
    select?: PersonaVideoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonaVideo
     */
    omit?: PersonaVideoOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaVideoInclude<ExtArgs> | null
    /**
     * The data needed to create a PersonaVideo.
     */
    data: XOR<PersonaVideoCreateInput, PersonaVideoUncheckedCreateInput>
  }

  /**
   * PersonaVideo createMany
   */
  export type PersonaVideoCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PersonaVideos.
     */
    data: PersonaVideoCreateManyInput | PersonaVideoCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PersonaVideo createManyAndReturn
   */
  export type PersonaVideoCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaVideo
     */
    select?: PersonaVideoSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PersonaVideo
     */
    omit?: PersonaVideoOmit<ExtArgs> | null
    /**
     * The data used to create many PersonaVideos.
     */
    data: PersonaVideoCreateManyInput | PersonaVideoCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaVideoIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * PersonaVideo update
   */
  export type PersonaVideoUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaVideo
     */
    select?: PersonaVideoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonaVideo
     */
    omit?: PersonaVideoOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaVideoInclude<ExtArgs> | null
    /**
     * The data needed to update a PersonaVideo.
     */
    data: XOR<PersonaVideoUpdateInput, PersonaVideoUncheckedUpdateInput>
    /**
     * Choose, which PersonaVideo to update.
     */
    where: PersonaVideoWhereUniqueInput
  }

  /**
   * PersonaVideo updateMany
   */
  export type PersonaVideoUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PersonaVideos.
     */
    data: XOR<PersonaVideoUpdateManyMutationInput, PersonaVideoUncheckedUpdateManyInput>
    /**
     * Filter which PersonaVideos to update
     */
    where?: PersonaVideoWhereInput
    /**
     * Limit how many PersonaVideos to update.
     */
    limit?: number
  }

  /**
   * PersonaVideo updateManyAndReturn
   */
  export type PersonaVideoUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaVideo
     */
    select?: PersonaVideoSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PersonaVideo
     */
    omit?: PersonaVideoOmit<ExtArgs> | null
    /**
     * The data used to update PersonaVideos.
     */
    data: XOR<PersonaVideoUpdateManyMutationInput, PersonaVideoUncheckedUpdateManyInput>
    /**
     * Filter which PersonaVideos to update
     */
    where?: PersonaVideoWhereInput
    /**
     * Limit how many PersonaVideos to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaVideoIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * PersonaVideo upsert
   */
  export type PersonaVideoUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaVideo
     */
    select?: PersonaVideoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonaVideo
     */
    omit?: PersonaVideoOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaVideoInclude<ExtArgs> | null
    /**
     * The filter to search for the PersonaVideo to update in case it exists.
     */
    where: PersonaVideoWhereUniqueInput
    /**
     * In case the PersonaVideo found by the `where` argument doesn't exist, create a new PersonaVideo with this data.
     */
    create: XOR<PersonaVideoCreateInput, PersonaVideoUncheckedCreateInput>
    /**
     * In case the PersonaVideo was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PersonaVideoUpdateInput, PersonaVideoUncheckedUpdateInput>
  }

  /**
   * PersonaVideo delete
   */
  export type PersonaVideoDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaVideo
     */
    select?: PersonaVideoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonaVideo
     */
    omit?: PersonaVideoOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaVideoInclude<ExtArgs> | null
    /**
     * Filter which PersonaVideo to delete.
     */
    where: PersonaVideoWhereUniqueInput
  }

  /**
   * PersonaVideo deleteMany
   */
  export type PersonaVideoDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PersonaVideos to delete
     */
    where?: PersonaVideoWhereInput
    /**
     * Limit how many PersonaVideos to delete.
     */
    limit?: number
  }

  /**
   * PersonaVideo without action
   */
  export type PersonaVideoDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PersonaVideo
     */
    select?: PersonaVideoSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PersonaVideo
     */
    omit?: PersonaVideoOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PersonaVideoInclude<ExtArgs> | null
  }


  /**
   * Model ChatSession
   */

  export type AggregateChatSession = {
    _count: ChatSessionCountAggregateOutputType | null
    _avg: ChatSessionAvgAggregateOutputType | null
    _sum: ChatSessionSumAggregateOutputType | null
    _min: ChatSessionMinAggregateOutputType | null
    _max: ChatSessionMaxAggregateOutputType | null
  }

  export type ChatSessionAvgAggregateOutputType = {
    id: number | null
    userId: number | null
  }

  export type ChatSessionSumAggregateOutputType = {
    id: number | null
    userId: number | null
  }

  export type ChatSessionMinAggregateOutputType = {
    id: number | null
    userId: number | null
    personaId: string | null
    title: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ChatSessionMaxAggregateOutputType = {
    id: number | null
    userId: number | null
    personaId: string | null
    title: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ChatSessionCountAggregateOutputType = {
    id: number
    userId: number
    personaId: number
    title: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type ChatSessionAvgAggregateInputType = {
    id?: true
    userId?: true
  }

  export type ChatSessionSumAggregateInputType = {
    id?: true
    userId?: true
  }

  export type ChatSessionMinAggregateInputType = {
    id?: true
    userId?: true
    personaId?: true
    title?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ChatSessionMaxAggregateInputType = {
    id?: true
    userId?: true
    personaId?: true
    title?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ChatSessionCountAggregateInputType = {
    id?: true
    userId?: true
    personaId?: true
    title?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type ChatSessionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ChatSession to aggregate.
     */
    where?: ChatSessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ChatSessions to fetch.
     */
    orderBy?: ChatSessionOrderByWithRelationInput | ChatSessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ChatSessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ChatSessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ChatSessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ChatSessions
    **/
    _count?: true | ChatSessionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ChatSessionAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ChatSessionSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ChatSessionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ChatSessionMaxAggregateInputType
  }

  export type GetChatSessionAggregateType<T extends ChatSessionAggregateArgs> = {
        [P in keyof T & keyof AggregateChatSession]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateChatSession[P]>
      : GetScalarType<T[P], AggregateChatSession[P]>
  }




  export type ChatSessionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ChatSessionWhereInput
    orderBy?: ChatSessionOrderByWithAggregationInput | ChatSessionOrderByWithAggregationInput[]
    by: ChatSessionScalarFieldEnum[] | ChatSessionScalarFieldEnum
    having?: ChatSessionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ChatSessionCountAggregateInputType | true
    _avg?: ChatSessionAvgAggregateInputType
    _sum?: ChatSessionSumAggregateInputType
    _min?: ChatSessionMinAggregateInputType
    _max?: ChatSessionMaxAggregateInputType
  }

  export type ChatSessionGroupByOutputType = {
    id: number
    userId: number
    personaId: string
    title: string | null
    createdAt: Date
    updatedAt: Date
    _count: ChatSessionCountAggregateOutputType | null
    _avg: ChatSessionAvgAggregateOutputType | null
    _sum: ChatSessionSumAggregateOutputType | null
    _min: ChatSessionMinAggregateOutputType | null
    _max: ChatSessionMaxAggregateOutputType | null
  }

  type GetChatSessionGroupByPayload<T extends ChatSessionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ChatSessionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ChatSessionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ChatSessionGroupByOutputType[P]>
            : GetScalarType<T[P], ChatSessionGroupByOutputType[P]>
        }
      >
    >


  export type ChatSessionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    personaId?: boolean
    title?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    persona?: boolean | PersonaDefaultArgs<ExtArgs>
    messages?: boolean | ChatSession$messagesArgs<ExtArgs>
    summary?: boolean | ChatSession$summaryArgs<ExtArgs>
    _count?: boolean | ChatSessionCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["chatSession"]>

  export type ChatSessionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    personaId?: boolean
    title?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    persona?: boolean | PersonaDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["chatSession"]>

  export type ChatSessionSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    personaId?: boolean
    title?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    persona?: boolean | PersonaDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["chatSession"]>

  export type ChatSessionSelectScalar = {
    id?: boolean
    userId?: boolean
    personaId?: boolean
    title?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type ChatSessionOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "personaId" | "title" | "createdAt" | "updatedAt", ExtArgs["result"]["chatSession"]>
  export type ChatSessionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    persona?: boolean | PersonaDefaultArgs<ExtArgs>
    messages?: boolean | ChatSession$messagesArgs<ExtArgs>
    summary?: boolean | ChatSession$summaryArgs<ExtArgs>
    _count?: boolean | ChatSessionCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type ChatSessionIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    persona?: boolean | PersonaDefaultArgs<ExtArgs>
  }
  export type ChatSessionIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    persona?: boolean | PersonaDefaultArgs<ExtArgs>
  }

  export type $ChatSessionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ChatSession"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
      persona: Prisma.$PersonaPayload<ExtArgs>
      messages: Prisma.$MessagePayload<ExtArgs>[]
      summary: Prisma.$ConversationSummaryPayload<ExtArgs> | null
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      userId: number
      personaId: string
      title: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["chatSession"]>
    composites: {}
  }

  type ChatSessionGetPayload<S extends boolean | null | undefined | ChatSessionDefaultArgs> = $Result.GetResult<Prisma.$ChatSessionPayload, S>

  type ChatSessionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<ChatSessionFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ChatSessionCountAggregateInputType | true
    }

  export interface ChatSessionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ChatSession'], meta: { name: 'ChatSession' } }
    /**
     * Find zero or one ChatSession that matches the filter.
     * @param {ChatSessionFindUniqueArgs} args - Arguments to find a ChatSession
     * @example
     * // Get one ChatSession
     * const chatSession = await prisma.chatSession.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ChatSessionFindUniqueArgs>(args: SelectSubset<T, ChatSessionFindUniqueArgs<ExtArgs>>): Prisma__ChatSessionClient<$Result.GetResult<Prisma.$ChatSessionPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one ChatSession that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ChatSessionFindUniqueOrThrowArgs} args - Arguments to find a ChatSession
     * @example
     * // Get one ChatSession
     * const chatSession = await prisma.chatSession.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ChatSessionFindUniqueOrThrowArgs>(args: SelectSubset<T, ChatSessionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ChatSessionClient<$Result.GetResult<Prisma.$ChatSessionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ChatSession that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ChatSessionFindFirstArgs} args - Arguments to find a ChatSession
     * @example
     * // Get one ChatSession
     * const chatSession = await prisma.chatSession.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ChatSessionFindFirstArgs>(args?: SelectSubset<T, ChatSessionFindFirstArgs<ExtArgs>>): Prisma__ChatSessionClient<$Result.GetResult<Prisma.$ChatSessionPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ChatSession that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ChatSessionFindFirstOrThrowArgs} args - Arguments to find a ChatSession
     * @example
     * // Get one ChatSession
     * const chatSession = await prisma.chatSession.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ChatSessionFindFirstOrThrowArgs>(args?: SelectSubset<T, ChatSessionFindFirstOrThrowArgs<ExtArgs>>): Prisma__ChatSessionClient<$Result.GetResult<Prisma.$ChatSessionPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more ChatSessions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ChatSessionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ChatSessions
     * const chatSessions = await prisma.chatSession.findMany()
     * 
     * // Get first 10 ChatSessions
     * const chatSessions = await prisma.chatSession.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const chatSessionWithIdOnly = await prisma.chatSession.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ChatSessionFindManyArgs>(args?: SelectSubset<T, ChatSessionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ChatSessionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a ChatSession.
     * @param {ChatSessionCreateArgs} args - Arguments to create a ChatSession.
     * @example
     * // Create one ChatSession
     * const ChatSession = await prisma.chatSession.create({
     *   data: {
     *     // ... data to create a ChatSession
     *   }
     * })
     * 
     */
    create<T extends ChatSessionCreateArgs>(args: SelectSubset<T, ChatSessionCreateArgs<ExtArgs>>): Prisma__ChatSessionClient<$Result.GetResult<Prisma.$ChatSessionPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many ChatSessions.
     * @param {ChatSessionCreateManyArgs} args - Arguments to create many ChatSessions.
     * @example
     * // Create many ChatSessions
     * const chatSession = await prisma.chatSession.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ChatSessionCreateManyArgs>(args?: SelectSubset<T, ChatSessionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ChatSessions and returns the data saved in the database.
     * @param {ChatSessionCreateManyAndReturnArgs} args - Arguments to create many ChatSessions.
     * @example
     * // Create many ChatSessions
     * const chatSession = await prisma.chatSession.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ChatSessions and only return the `id`
     * const chatSessionWithIdOnly = await prisma.chatSession.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ChatSessionCreateManyAndReturnArgs>(args?: SelectSubset<T, ChatSessionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ChatSessionPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a ChatSession.
     * @param {ChatSessionDeleteArgs} args - Arguments to delete one ChatSession.
     * @example
     * // Delete one ChatSession
     * const ChatSession = await prisma.chatSession.delete({
     *   where: {
     *     // ... filter to delete one ChatSession
     *   }
     * })
     * 
     */
    delete<T extends ChatSessionDeleteArgs>(args: SelectSubset<T, ChatSessionDeleteArgs<ExtArgs>>): Prisma__ChatSessionClient<$Result.GetResult<Prisma.$ChatSessionPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one ChatSession.
     * @param {ChatSessionUpdateArgs} args - Arguments to update one ChatSession.
     * @example
     * // Update one ChatSession
     * const chatSession = await prisma.chatSession.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ChatSessionUpdateArgs>(args: SelectSubset<T, ChatSessionUpdateArgs<ExtArgs>>): Prisma__ChatSessionClient<$Result.GetResult<Prisma.$ChatSessionPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more ChatSessions.
     * @param {ChatSessionDeleteManyArgs} args - Arguments to filter ChatSessions to delete.
     * @example
     * // Delete a few ChatSessions
     * const { count } = await prisma.chatSession.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ChatSessionDeleteManyArgs>(args?: SelectSubset<T, ChatSessionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ChatSessions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ChatSessionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ChatSessions
     * const chatSession = await prisma.chatSession.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ChatSessionUpdateManyArgs>(args: SelectSubset<T, ChatSessionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ChatSessions and returns the data updated in the database.
     * @param {ChatSessionUpdateManyAndReturnArgs} args - Arguments to update many ChatSessions.
     * @example
     * // Update many ChatSessions
     * const chatSession = await prisma.chatSession.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more ChatSessions and only return the `id`
     * const chatSessionWithIdOnly = await prisma.chatSession.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends ChatSessionUpdateManyAndReturnArgs>(args: SelectSubset<T, ChatSessionUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ChatSessionPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one ChatSession.
     * @param {ChatSessionUpsertArgs} args - Arguments to update or create a ChatSession.
     * @example
     * // Update or create a ChatSession
     * const chatSession = await prisma.chatSession.upsert({
     *   create: {
     *     // ... data to create a ChatSession
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ChatSession we want to update
     *   }
     * })
     */
    upsert<T extends ChatSessionUpsertArgs>(args: SelectSubset<T, ChatSessionUpsertArgs<ExtArgs>>): Prisma__ChatSessionClient<$Result.GetResult<Prisma.$ChatSessionPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of ChatSessions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ChatSessionCountArgs} args - Arguments to filter ChatSessions to count.
     * @example
     * // Count the number of ChatSessions
     * const count = await prisma.chatSession.count({
     *   where: {
     *     // ... the filter for the ChatSessions we want to count
     *   }
     * })
    **/
    count<T extends ChatSessionCountArgs>(
      args?: Subset<T, ChatSessionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ChatSessionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ChatSession.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ChatSessionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ChatSessionAggregateArgs>(args: Subset<T, ChatSessionAggregateArgs>): Prisma.PrismaPromise<GetChatSessionAggregateType<T>>

    /**
     * Group by ChatSession.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ChatSessionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ChatSessionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ChatSessionGroupByArgs['orderBy'] }
        : { orderBy?: ChatSessionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ChatSessionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetChatSessionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ChatSession model
   */
  readonly fields: ChatSessionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ChatSession.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ChatSessionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    persona<T extends PersonaDefaultArgs<ExtArgs> = {}>(args?: Subset<T, PersonaDefaultArgs<ExtArgs>>): Prisma__PersonaClient<$Result.GetResult<Prisma.$PersonaPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    messages<T extends ChatSession$messagesArgs<ExtArgs> = {}>(args?: Subset<T, ChatSession$messagesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    summary<T extends ChatSession$summaryArgs<ExtArgs> = {}>(args?: Subset<T, ChatSession$summaryArgs<ExtArgs>>): Prisma__ConversationSummaryClient<$Result.GetResult<Prisma.$ConversationSummaryPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ChatSession model
   */
  interface ChatSessionFieldRefs {
    readonly id: FieldRef<"ChatSession", 'Int'>
    readonly userId: FieldRef<"ChatSession", 'Int'>
    readonly personaId: FieldRef<"ChatSession", 'String'>
    readonly title: FieldRef<"ChatSession", 'String'>
    readonly createdAt: FieldRef<"ChatSession", 'DateTime'>
    readonly updatedAt: FieldRef<"ChatSession", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * ChatSession findUnique
   */
  export type ChatSessionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ChatSession
     */
    select?: ChatSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ChatSession
     */
    omit?: ChatSessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ChatSessionInclude<ExtArgs> | null
    /**
     * Filter, which ChatSession to fetch.
     */
    where: ChatSessionWhereUniqueInput
  }

  /**
   * ChatSession findUniqueOrThrow
   */
  export type ChatSessionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ChatSession
     */
    select?: ChatSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ChatSession
     */
    omit?: ChatSessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ChatSessionInclude<ExtArgs> | null
    /**
     * Filter, which ChatSession to fetch.
     */
    where: ChatSessionWhereUniqueInput
  }

  /**
   * ChatSession findFirst
   */
  export type ChatSessionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ChatSession
     */
    select?: ChatSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ChatSession
     */
    omit?: ChatSessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ChatSessionInclude<ExtArgs> | null
    /**
     * Filter, which ChatSession to fetch.
     */
    where?: ChatSessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ChatSessions to fetch.
     */
    orderBy?: ChatSessionOrderByWithRelationInput | ChatSessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ChatSessions.
     */
    cursor?: ChatSessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ChatSessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ChatSessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ChatSessions.
     */
    distinct?: ChatSessionScalarFieldEnum | ChatSessionScalarFieldEnum[]
  }

  /**
   * ChatSession findFirstOrThrow
   */
  export type ChatSessionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ChatSession
     */
    select?: ChatSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ChatSession
     */
    omit?: ChatSessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ChatSessionInclude<ExtArgs> | null
    /**
     * Filter, which ChatSession to fetch.
     */
    where?: ChatSessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ChatSessions to fetch.
     */
    orderBy?: ChatSessionOrderByWithRelationInput | ChatSessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ChatSessions.
     */
    cursor?: ChatSessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ChatSessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ChatSessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ChatSessions.
     */
    distinct?: ChatSessionScalarFieldEnum | ChatSessionScalarFieldEnum[]
  }

  /**
   * ChatSession findMany
   */
  export type ChatSessionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ChatSession
     */
    select?: ChatSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ChatSession
     */
    omit?: ChatSessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ChatSessionInclude<ExtArgs> | null
    /**
     * Filter, which ChatSessions to fetch.
     */
    where?: ChatSessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ChatSessions to fetch.
     */
    orderBy?: ChatSessionOrderByWithRelationInput | ChatSessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ChatSessions.
     */
    cursor?: ChatSessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ChatSessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ChatSessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ChatSessions.
     */
    distinct?: ChatSessionScalarFieldEnum | ChatSessionScalarFieldEnum[]
  }

  /**
   * ChatSession create
   */
  export type ChatSessionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ChatSession
     */
    select?: ChatSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ChatSession
     */
    omit?: ChatSessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ChatSessionInclude<ExtArgs> | null
    /**
     * The data needed to create a ChatSession.
     */
    data: XOR<ChatSessionCreateInput, ChatSessionUncheckedCreateInput>
  }

  /**
   * ChatSession createMany
   */
  export type ChatSessionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ChatSessions.
     */
    data: ChatSessionCreateManyInput | ChatSessionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ChatSession createManyAndReturn
   */
  export type ChatSessionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ChatSession
     */
    select?: ChatSessionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ChatSession
     */
    omit?: ChatSessionOmit<ExtArgs> | null
    /**
     * The data used to create many ChatSessions.
     */
    data: ChatSessionCreateManyInput | ChatSessionCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ChatSessionIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * ChatSession update
   */
  export type ChatSessionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ChatSession
     */
    select?: ChatSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ChatSession
     */
    omit?: ChatSessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ChatSessionInclude<ExtArgs> | null
    /**
     * The data needed to update a ChatSession.
     */
    data: XOR<ChatSessionUpdateInput, ChatSessionUncheckedUpdateInput>
    /**
     * Choose, which ChatSession to update.
     */
    where: ChatSessionWhereUniqueInput
  }

  /**
   * ChatSession updateMany
   */
  export type ChatSessionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ChatSessions.
     */
    data: XOR<ChatSessionUpdateManyMutationInput, ChatSessionUncheckedUpdateManyInput>
    /**
     * Filter which ChatSessions to update
     */
    where?: ChatSessionWhereInput
    /**
     * Limit how many ChatSessions to update.
     */
    limit?: number
  }

  /**
   * ChatSession updateManyAndReturn
   */
  export type ChatSessionUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ChatSession
     */
    select?: ChatSessionSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ChatSession
     */
    omit?: ChatSessionOmit<ExtArgs> | null
    /**
     * The data used to update ChatSessions.
     */
    data: XOR<ChatSessionUpdateManyMutationInput, ChatSessionUncheckedUpdateManyInput>
    /**
     * Filter which ChatSessions to update
     */
    where?: ChatSessionWhereInput
    /**
     * Limit how many ChatSessions to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ChatSessionIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * ChatSession upsert
   */
  export type ChatSessionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ChatSession
     */
    select?: ChatSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ChatSession
     */
    omit?: ChatSessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ChatSessionInclude<ExtArgs> | null
    /**
     * The filter to search for the ChatSession to update in case it exists.
     */
    where: ChatSessionWhereUniqueInput
    /**
     * In case the ChatSession found by the `where` argument doesn't exist, create a new ChatSession with this data.
     */
    create: XOR<ChatSessionCreateInput, ChatSessionUncheckedCreateInput>
    /**
     * In case the ChatSession was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ChatSessionUpdateInput, ChatSessionUncheckedUpdateInput>
  }

  /**
   * ChatSession delete
   */
  export type ChatSessionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ChatSession
     */
    select?: ChatSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ChatSession
     */
    omit?: ChatSessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ChatSessionInclude<ExtArgs> | null
    /**
     * Filter which ChatSession to delete.
     */
    where: ChatSessionWhereUniqueInput
  }

  /**
   * ChatSession deleteMany
   */
  export type ChatSessionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ChatSessions to delete
     */
    where?: ChatSessionWhereInput
    /**
     * Limit how many ChatSessions to delete.
     */
    limit?: number
  }

  /**
   * ChatSession.messages
   */
  export type ChatSession$messagesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    where?: MessageWhereInput
    orderBy?: MessageOrderByWithRelationInput | MessageOrderByWithRelationInput[]
    cursor?: MessageWhereUniqueInput
    take?: number
    skip?: number
    distinct?: MessageScalarFieldEnum | MessageScalarFieldEnum[]
  }

  /**
   * ChatSession.summary
   */
  export type ChatSession$summaryArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConversationSummary
     */
    select?: ConversationSummarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the ConversationSummary
     */
    omit?: ConversationSummaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConversationSummaryInclude<ExtArgs> | null
    where?: ConversationSummaryWhereInput
  }

  /**
   * ChatSession without action
   */
  export type ChatSessionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ChatSession
     */
    select?: ChatSessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ChatSession
     */
    omit?: ChatSessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ChatSessionInclude<ExtArgs> | null
  }


  /**
   * Model Message
   */

  export type AggregateMessage = {
    _count: MessageCountAggregateOutputType | null
    _avg: MessageAvgAggregateOutputType | null
    _sum: MessageSumAggregateOutputType | null
    _min: MessageMinAggregateOutputType | null
    _max: MessageMaxAggregateOutputType | null
  }

  export type MessageAvgAggregateOutputType = {
    id: number | null
    sessionId: number | null
  }

  export type MessageSumAggregateOutputType = {
    id: number | null
    sessionId: number | null
  }

  export type MessageMinAggregateOutputType = {
    id: number | null
    sessionId: number | null
    role: string | null
    text: string | null
    createdAt: Date | null
  }

  export type MessageMaxAggregateOutputType = {
    id: number | null
    sessionId: number | null
    role: string | null
    text: string | null
    createdAt: Date | null
  }

  export type MessageCountAggregateOutputType = {
    id: number
    sessionId: number
    role: number
    text: number
    createdAt: number
    _all: number
  }


  export type MessageAvgAggregateInputType = {
    id?: true
    sessionId?: true
  }

  export type MessageSumAggregateInputType = {
    id?: true
    sessionId?: true
  }

  export type MessageMinAggregateInputType = {
    id?: true
    sessionId?: true
    role?: true
    text?: true
    createdAt?: true
  }

  export type MessageMaxAggregateInputType = {
    id?: true
    sessionId?: true
    role?: true
    text?: true
    createdAt?: true
  }

  export type MessageCountAggregateInputType = {
    id?: true
    sessionId?: true
    role?: true
    text?: true
    createdAt?: true
    _all?: true
  }

  export type MessageAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Message to aggregate.
     */
    where?: MessageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Messages to fetch.
     */
    orderBy?: MessageOrderByWithRelationInput | MessageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: MessageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Messages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Messages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Messages
    **/
    _count?: true | MessageCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: MessageAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: MessageSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: MessageMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: MessageMaxAggregateInputType
  }

  export type GetMessageAggregateType<T extends MessageAggregateArgs> = {
        [P in keyof T & keyof AggregateMessage]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateMessage[P]>
      : GetScalarType<T[P], AggregateMessage[P]>
  }




  export type MessageGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: MessageWhereInput
    orderBy?: MessageOrderByWithAggregationInput | MessageOrderByWithAggregationInput[]
    by: MessageScalarFieldEnum[] | MessageScalarFieldEnum
    having?: MessageScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: MessageCountAggregateInputType | true
    _avg?: MessageAvgAggregateInputType
    _sum?: MessageSumAggregateInputType
    _min?: MessageMinAggregateInputType
    _max?: MessageMaxAggregateInputType
  }

  export type MessageGroupByOutputType = {
    id: number
    sessionId: number
    role: string
    text: string
    createdAt: Date
    _count: MessageCountAggregateOutputType | null
    _avg: MessageAvgAggregateOutputType | null
    _sum: MessageSumAggregateOutputType | null
    _min: MessageMinAggregateOutputType | null
    _max: MessageMaxAggregateOutputType | null
  }

  type GetMessageGroupByPayload<T extends MessageGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<MessageGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof MessageGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], MessageGroupByOutputType[P]>
            : GetScalarType<T[P], MessageGroupByOutputType[P]>
        }
      >
    >


  export type MessageSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    sessionId?: boolean
    role?: boolean
    text?: boolean
    createdAt?: boolean
    session?: boolean | ChatSessionDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["message"]>

  export type MessageSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    sessionId?: boolean
    role?: boolean
    text?: boolean
    createdAt?: boolean
    session?: boolean | ChatSessionDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["message"]>

  export type MessageSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    sessionId?: boolean
    role?: boolean
    text?: boolean
    createdAt?: boolean
    session?: boolean | ChatSessionDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["message"]>

  export type MessageSelectScalar = {
    id?: boolean
    sessionId?: boolean
    role?: boolean
    text?: boolean
    createdAt?: boolean
  }

  export type MessageOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "sessionId" | "role" | "text" | "createdAt", ExtArgs["result"]["message"]>
  export type MessageInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    session?: boolean | ChatSessionDefaultArgs<ExtArgs>
  }
  export type MessageIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    session?: boolean | ChatSessionDefaultArgs<ExtArgs>
  }
  export type MessageIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    session?: boolean | ChatSessionDefaultArgs<ExtArgs>
  }

  export type $MessagePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Message"
    objects: {
      session: Prisma.$ChatSessionPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      sessionId: number
      role: string
      text: string
      createdAt: Date
    }, ExtArgs["result"]["message"]>
    composites: {}
  }

  type MessageGetPayload<S extends boolean | null | undefined | MessageDefaultArgs> = $Result.GetResult<Prisma.$MessagePayload, S>

  type MessageCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<MessageFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: MessageCountAggregateInputType | true
    }

  export interface MessageDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Message'], meta: { name: 'Message' } }
    /**
     * Find zero or one Message that matches the filter.
     * @param {MessageFindUniqueArgs} args - Arguments to find a Message
     * @example
     * // Get one Message
     * const message = await prisma.message.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends MessageFindUniqueArgs>(args: SelectSubset<T, MessageFindUniqueArgs<ExtArgs>>): Prisma__MessageClient<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Message that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {MessageFindUniqueOrThrowArgs} args - Arguments to find a Message
     * @example
     * // Get one Message
     * const message = await prisma.message.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends MessageFindUniqueOrThrowArgs>(args: SelectSubset<T, MessageFindUniqueOrThrowArgs<ExtArgs>>): Prisma__MessageClient<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Message that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MessageFindFirstArgs} args - Arguments to find a Message
     * @example
     * // Get one Message
     * const message = await prisma.message.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends MessageFindFirstArgs>(args?: SelectSubset<T, MessageFindFirstArgs<ExtArgs>>): Prisma__MessageClient<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Message that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MessageFindFirstOrThrowArgs} args - Arguments to find a Message
     * @example
     * // Get one Message
     * const message = await prisma.message.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends MessageFindFirstOrThrowArgs>(args?: SelectSubset<T, MessageFindFirstOrThrowArgs<ExtArgs>>): Prisma__MessageClient<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Messages that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MessageFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Messages
     * const messages = await prisma.message.findMany()
     * 
     * // Get first 10 Messages
     * const messages = await prisma.message.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const messageWithIdOnly = await prisma.message.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends MessageFindManyArgs>(args?: SelectSubset<T, MessageFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Message.
     * @param {MessageCreateArgs} args - Arguments to create a Message.
     * @example
     * // Create one Message
     * const Message = await prisma.message.create({
     *   data: {
     *     // ... data to create a Message
     *   }
     * })
     * 
     */
    create<T extends MessageCreateArgs>(args: SelectSubset<T, MessageCreateArgs<ExtArgs>>): Prisma__MessageClient<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Messages.
     * @param {MessageCreateManyArgs} args - Arguments to create many Messages.
     * @example
     * // Create many Messages
     * const message = await prisma.message.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends MessageCreateManyArgs>(args?: SelectSubset<T, MessageCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Messages and returns the data saved in the database.
     * @param {MessageCreateManyAndReturnArgs} args - Arguments to create many Messages.
     * @example
     * // Create many Messages
     * const message = await prisma.message.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Messages and only return the `id`
     * const messageWithIdOnly = await prisma.message.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends MessageCreateManyAndReturnArgs>(args?: SelectSubset<T, MessageCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Message.
     * @param {MessageDeleteArgs} args - Arguments to delete one Message.
     * @example
     * // Delete one Message
     * const Message = await prisma.message.delete({
     *   where: {
     *     // ... filter to delete one Message
     *   }
     * })
     * 
     */
    delete<T extends MessageDeleteArgs>(args: SelectSubset<T, MessageDeleteArgs<ExtArgs>>): Prisma__MessageClient<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Message.
     * @param {MessageUpdateArgs} args - Arguments to update one Message.
     * @example
     * // Update one Message
     * const message = await prisma.message.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends MessageUpdateArgs>(args: SelectSubset<T, MessageUpdateArgs<ExtArgs>>): Prisma__MessageClient<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Messages.
     * @param {MessageDeleteManyArgs} args - Arguments to filter Messages to delete.
     * @example
     * // Delete a few Messages
     * const { count } = await prisma.message.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends MessageDeleteManyArgs>(args?: SelectSubset<T, MessageDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Messages.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MessageUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Messages
     * const message = await prisma.message.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends MessageUpdateManyArgs>(args: SelectSubset<T, MessageUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Messages and returns the data updated in the database.
     * @param {MessageUpdateManyAndReturnArgs} args - Arguments to update many Messages.
     * @example
     * // Update many Messages
     * const message = await prisma.message.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Messages and only return the `id`
     * const messageWithIdOnly = await prisma.message.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends MessageUpdateManyAndReturnArgs>(args: SelectSubset<T, MessageUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Message.
     * @param {MessageUpsertArgs} args - Arguments to update or create a Message.
     * @example
     * // Update or create a Message
     * const message = await prisma.message.upsert({
     *   create: {
     *     // ... data to create a Message
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Message we want to update
     *   }
     * })
     */
    upsert<T extends MessageUpsertArgs>(args: SelectSubset<T, MessageUpsertArgs<ExtArgs>>): Prisma__MessageClient<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Messages.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MessageCountArgs} args - Arguments to filter Messages to count.
     * @example
     * // Count the number of Messages
     * const count = await prisma.message.count({
     *   where: {
     *     // ... the filter for the Messages we want to count
     *   }
     * })
    **/
    count<T extends MessageCountArgs>(
      args?: Subset<T, MessageCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], MessageCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Message.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MessageAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends MessageAggregateArgs>(args: Subset<T, MessageAggregateArgs>): Prisma.PrismaPromise<GetMessageAggregateType<T>>

    /**
     * Group by Message.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MessageGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends MessageGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: MessageGroupByArgs['orderBy'] }
        : { orderBy?: MessageGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, MessageGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetMessageGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Message model
   */
  readonly fields: MessageFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Message.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__MessageClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    session<T extends ChatSessionDefaultArgs<ExtArgs> = {}>(args?: Subset<T, ChatSessionDefaultArgs<ExtArgs>>): Prisma__ChatSessionClient<$Result.GetResult<Prisma.$ChatSessionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Message model
   */
  interface MessageFieldRefs {
    readonly id: FieldRef<"Message", 'Int'>
    readonly sessionId: FieldRef<"Message", 'Int'>
    readonly role: FieldRef<"Message", 'String'>
    readonly text: FieldRef<"Message", 'String'>
    readonly createdAt: FieldRef<"Message", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Message findUnique
   */
  export type MessageFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    /**
     * Filter, which Message to fetch.
     */
    where: MessageWhereUniqueInput
  }

  /**
   * Message findUniqueOrThrow
   */
  export type MessageFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    /**
     * Filter, which Message to fetch.
     */
    where: MessageWhereUniqueInput
  }

  /**
   * Message findFirst
   */
  export type MessageFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    /**
     * Filter, which Message to fetch.
     */
    where?: MessageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Messages to fetch.
     */
    orderBy?: MessageOrderByWithRelationInput | MessageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Messages.
     */
    cursor?: MessageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Messages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Messages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Messages.
     */
    distinct?: MessageScalarFieldEnum | MessageScalarFieldEnum[]
  }

  /**
   * Message findFirstOrThrow
   */
  export type MessageFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    /**
     * Filter, which Message to fetch.
     */
    where?: MessageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Messages to fetch.
     */
    orderBy?: MessageOrderByWithRelationInput | MessageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Messages.
     */
    cursor?: MessageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Messages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Messages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Messages.
     */
    distinct?: MessageScalarFieldEnum | MessageScalarFieldEnum[]
  }

  /**
   * Message findMany
   */
  export type MessageFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    /**
     * Filter, which Messages to fetch.
     */
    where?: MessageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Messages to fetch.
     */
    orderBy?: MessageOrderByWithRelationInput | MessageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Messages.
     */
    cursor?: MessageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Messages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Messages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Messages.
     */
    distinct?: MessageScalarFieldEnum | MessageScalarFieldEnum[]
  }

  /**
   * Message create
   */
  export type MessageCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    /**
     * The data needed to create a Message.
     */
    data: XOR<MessageCreateInput, MessageUncheckedCreateInput>
  }

  /**
   * Message createMany
   */
  export type MessageCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Messages.
     */
    data: MessageCreateManyInput | MessageCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Message createManyAndReturn
   */
  export type MessageCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * The data used to create many Messages.
     */
    data: MessageCreateManyInput | MessageCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Message update
   */
  export type MessageUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    /**
     * The data needed to update a Message.
     */
    data: XOR<MessageUpdateInput, MessageUncheckedUpdateInput>
    /**
     * Choose, which Message to update.
     */
    where: MessageWhereUniqueInput
  }

  /**
   * Message updateMany
   */
  export type MessageUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Messages.
     */
    data: XOR<MessageUpdateManyMutationInput, MessageUncheckedUpdateManyInput>
    /**
     * Filter which Messages to update
     */
    where?: MessageWhereInput
    /**
     * Limit how many Messages to update.
     */
    limit?: number
  }

  /**
   * Message updateManyAndReturn
   */
  export type MessageUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * The data used to update Messages.
     */
    data: XOR<MessageUpdateManyMutationInput, MessageUncheckedUpdateManyInput>
    /**
     * Filter which Messages to update
     */
    where?: MessageWhereInput
    /**
     * Limit how many Messages to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Message upsert
   */
  export type MessageUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    /**
     * The filter to search for the Message to update in case it exists.
     */
    where: MessageWhereUniqueInput
    /**
     * In case the Message found by the `where` argument doesn't exist, create a new Message with this data.
     */
    create: XOR<MessageCreateInput, MessageUncheckedCreateInput>
    /**
     * In case the Message was found with the provided `where` argument, update it with this data.
     */
    update: XOR<MessageUpdateInput, MessageUncheckedUpdateInput>
  }

  /**
   * Message delete
   */
  export type MessageDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    /**
     * Filter which Message to delete.
     */
    where: MessageWhereUniqueInput
  }

  /**
   * Message deleteMany
   */
  export type MessageDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Messages to delete
     */
    where?: MessageWhereInput
    /**
     * Limit how many Messages to delete.
     */
    limit?: number
  }

  /**
   * Message without action
   */
  export type MessageDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
  }


  /**
   * Model ConversationSummary
   */

  export type AggregateConversationSummary = {
    _count: ConversationSummaryCountAggregateOutputType | null
    _avg: ConversationSummaryAvgAggregateOutputType | null
    _sum: ConversationSummarySumAggregateOutputType | null
    _min: ConversationSummaryMinAggregateOutputType | null
    _max: ConversationSummaryMaxAggregateOutputType | null
  }

  export type ConversationSummaryAvgAggregateOutputType = {
    id: number | null
    sessionId: number | null
    messageCount: number | null
  }

  export type ConversationSummarySumAggregateOutputType = {
    id: number | null
    sessionId: number | null
    messageCount: number | null
  }

  export type ConversationSummaryMinAggregateOutputType = {
    id: number | null
    sessionId: number | null
    summary: string | null
    messageCount: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ConversationSummaryMaxAggregateOutputType = {
    id: number | null
    sessionId: number | null
    summary: string | null
    messageCount: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ConversationSummaryCountAggregateOutputType = {
    id: number
    sessionId: number
    summary: number
    messageCount: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type ConversationSummaryAvgAggregateInputType = {
    id?: true
    sessionId?: true
    messageCount?: true
  }

  export type ConversationSummarySumAggregateInputType = {
    id?: true
    sessionId?: true
    messageCount?: true
  }

  export type ConversationSummaryMinAggregateInputType = {
    id?: true
    sessionId?: true
    summary?: true
    messageCount?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ConversationSummaryMaxAggregateInputType = {
    id?: true
    sessionId?: true
    summary?: true
    messageCount?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ConversationSummaryCountAggregateInputType = {
    id?: true
    sessionId?: true
    summary?: true
    messageCount?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type ConversationSummaryAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ConversationSummary to aggregate.
     */
    where?: ConversationSummaryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ConversationSummaries to fetch.
     */
    orderBy?: ConversationSummaryOrderByWithRelationInput | ConversationSummaryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ConversationSummaryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ConversationSummaries from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ConversationSummaries.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ConversationSummaries
    **/
    _count?: true | ConversationSummaryCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ConversationSummaryAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ConversationSummarySumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ConversationSummaryMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ConversationSummaryMaxAggregateInputType
  }

  export type GetConversationSummaryAggregateType<T extends ConversationSummaryAggregateArgs> = {
        [P in keyof T & keyof AggregateConversationSummary]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateConversationSummary[P]>
      : GetScalarType<T[P], AggregateConversationSummary[P]>
  }




  export type ConversationSummaryGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ConversationSummaryWhereInput
    orderBy?: ConversationSummaryOrderByWithAggregationInput | ConversationSummaryOrderByWithAggregationInput[]
    by: ConversationSummaryScalarFieldEnum[] | ConversationSummaryScalarFieldEnum
    having?: ConversationSummaryScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ConversationSummaryCountAggregateInputType | true
    _avg?: ConversationSummaryAvgAggregateInputType
    _sum?: ConversationSummarySumAggregateInputType
    _min?: ConversationSummaryMinAggregateInputType
    _max?: ConversationSummaryMaxAggregateInputType
  }

  export type ConversationSummaryGroupByOutputType = {
    id: number
    sessionId: number
    summary: string
    messageCount: number
    createdAt: Date
    updatedAt: Date
    _count: ConversationSummaryCountAggregateOutputType | null
    _avg: ConversationSummaryAvgAggregateOutputType | null
    _sum: ConversationSummarySumAggregateOutputType | null
    _min: ConversationSummaryMinAggregateOutputType | null
    _max: ConversationSummaryMaxAggregateOutputType | null
  }

  type GetConversationSummaryGroupByPayload<T extends ConversationSummaryGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ConversationSummaryGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ConversationSummaryGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ConversationSummaryGroupByOutputType[P]>
            : GetScalarType<T[P], ConversationSummaryGroupByOutputType[P]>
        }
      >
    >


  export type ConversationSummarySelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    sessionId?: boolean
    summary?: boolean
    messageCount?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    session?: boolean | ChatSessionDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["conversationSummary"]>

  export type ConversationSummarySelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    sessionId?: boolean
    summary?: boolean
    messageCount?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    session?: boolean | ChatSessionDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["conversationSummary"]>

  export type ConversationSummarySelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    sessionId?: boolean
    summary?: boolean
    messageCount?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    session?: boolean | ChatSessionDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["conversationSummary"]>

  export type ConversationSummarySelectScalar = {
    id?: boolean
    sessionId?: boolean
    summary?: boolean
    messageCount?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type ConversationSummaryOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "sessionId" | "summary" | "messageCount" | "createdAt" | "updatedAt", ExtArgs["result"]["conversationSummary"]>
  export type ConversationSummaryInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    session?: boolean | ChatSessionDefaultArgs<ExtArgs>
  }
  export type ConversationSummaryIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    session?: boolean | ChatSessionDefaultArgs<ExtArgs>
  }
  export type ConversationSummaryIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    session?: boolean | ChatSessionDefaultArgs<ExtArgs>
  }

  export type $ConversationSummaryPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ConversationSummary"
    objects: {
      session: Prisma.$ChatSessionPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      sessionId: number
      summary: string
      messageCount: number
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["conversationSummary"]>
    composites: {}
  }

  type ConversationSummaryGetPayload<S extends boolean | null | undefined | ConversationSummaryDefaultArgs> = $Result.GetResult<Prisma.$ConversationSummaryPayload, S>

  type ConversationSummaryCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<ConversationSummaryFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ConversationSummaryCountAggregateInputType | true
    }

  export interface ConversationSummaryDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ConversationSummary'], meta: { name: 'ConversationSummary' } }
    /**
     * Find zero or one ConversationSummary that matches the filter.
     * @param {ConversationSummaryFindUniqueArgs} args - Arguments to find a ConversationSummary
     * @example
     * // Get one ConversationSummary
     * const conversationSummary = await prisma.conversationSummary.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ConversationSummaryFindUniqueArgs>(args: SelectSubset<T, ConversationSummaryFindUniqueArgs<ExtArgs>>): Prisma__ConversationSummaryClient<$Result.GetResult<Prisma.$ConversationSummaryPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one ConversationSummary that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ConversationSummaryFindUniqueOrThrowArgs} args - Arguments to find a ConversationSummary
     * @example
     * // Get one ConversationSummary
     * const conversationSummary = await prisma.conversationSummary.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ConversationSummaryFindUniqueOrThrowArgs>(args: SelectSubset<T, ConversationSummaryFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ConversationSummaryClient<$Result.GetResult<Prisma.$ConversationSummaryPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ConversationSummary that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ConversationSummaryFindFirstArgs} args - Arguments to find a ConversationSummary
     * @example
     * // Get one ConversationSummary
     * const conversationSummary = await prisma.conversationSummary.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ConversationSummaryFindFirstArgs>(args?: SelectSubset<T, ConversationSummaryFindFirstArgs<ExtArgs>>): Prisma__ConversationSummaryClient<$Result.GetResult<Prisma.$ConversationSummaryPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ConversationSummary that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ConversationSummaryFindFirstOrThrowArgs} args - Arguments to find a ConversationSummary
     * @example
     * // Get one ConversationSummary
     * const conversationSummary = await prisma.conversationSummary.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ConversationSummaryFindFirstOrThrowArgs>(args?: SelectSubset<T, ConversationSummaryFindFirstOrThrowArgs<ExtArgs>>): Prisma__ConversationSummaryClient<$Result.GetResult<Prisma.$ConversationSummaryPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more ConversationSummaries that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ConversationSummaryFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ConversationSummaries
     * const conversationSummaries = await prisma.conversationSummary.findMany()
     * 
     * // Get first 10 ConversationSummaries
     * const conversationSummaries = await prisma.conversationSummary.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const conversationSummaryWithIdOnly = await prisma.conversationSummary.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ConversationSummaryFindManyArgs>(args?: SelectSubset<T, ConversationSummaryFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ConversationSummaryPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a ConversationSummary.
     * @param {ConversationSummaryCreateArgs} args - Arguments to create a ConversationSummary.
     * @example
     * // Create one ConversationSummary
     * const ConversationSummary = await prisma.conversationSummary.create({
     *   data: {
     *     // ... data to create a ConversationSummary
     *   }
     * })
     * 
     */
    create<T extends ConversationSummaryCreateArgs>(args: SelectSubset<T, ConversationSummaryCreateArgs<ExtArgs>>): Prisma__ConversationSummaryClient<$Result.GetResult<Prisma.$ConversationSummaryPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many ConversationSummaries.
     * @param {ConversationSummaryCreateManyArgs} args - Arguments to create many ConversationSummaries.
     * @example
     * // Create many ConversationSummaries
     * const conversationSummary = await prisma.conversationSummary.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ConversationSummaryCreateManyArgs>(args?: SelectSubset<T, ConversationSummaryCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ConversationSummaries and returns the data saved in the database.
     * @param {ConversationSummaryCreateManyAndReturnArgs} args - Arguments to create many ConversationSummaries.
     * @example
     * // Create many ConversationSummaries
     * const conversationSummary = await prisma.conversationSummary.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ConversationSummaries and only return the `id`
     * const conversationSummaryWithIdOnly = await prisma.conversationSummary.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ConversationSummaryCreateManyAndReturnArgs>(args?: SelectSubset<T, ConversationSummaryCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ConversationSummaryPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a ConversationSummary.
     * @param {ConversationSummaryDeleteArgs} args - Arguments to delete one ConversationSummary.
     * @example
     * // Delete one ConversationSummary
     * const ConversationSummary = await prisma.conversationSummary.delete({
     *   where: {
     *     // ... filter to delete one ConversationSummary
     *   }
     * })
     * 
     */
    delete<T extends ConversationSummaryDeleteArgs>(args: SelectSubset<T, ConversationSummaryDeleteArgs<ExtArgs>>): Prisma__ConversationSummaryClient<$Result.GetResult<Prisma.$ConversationSummaryPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one ConversationSummary.
     * @param {ConversationSummaryUpdateArgs} args - Arguments to update one ConversationSummary.
     * @example
     * // Update one ConversationSummary
     * const conversationSummary = await prisma.conversationSummary.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ConversationSummaryUpdateArgs>(args: SelectSubset<T, ConversationSummaryUpdateArgs<ExtArgs>>): Prisma__ConversationSummaryClient<$Result.GetResult<Prisma.$ConversationSummaryPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more ConversationSummaries.
     * @param {ConversationSummaryDeleteManyArgs} args - Arguments to filter ConversationSummaries to delete.
     * @example
     * // Delete a few ConversationSummaries
     * const { count } = await prisma.conversationSummary.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ConversationSummaryDeleteManyArgs>(args?: SelectSubset<T, ConversationSummaryDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ConversationSummaries.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ConversationSummaryUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ConversationSummaries
     * const conversationSummary = await prisma.conversationSummary.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ConversationSummaryUpdateManyArgs>(args: SelectSubset<T, ConversationSummaryUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ConversationSummaries and returns the data updated in the database.
     * @param {ConversationSummaryUpdateManyAndReturnArgs} args - Arguments to update many ConversationSummaries.
     * @example
     * // Update many ConversationSummaries
     * const conversationSummary = await prisma.conversationSummary.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more ConversationSummaries and only return the `id`
     * const conversationSummaryWithIdOnly = await prisma.conversationSummary.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends ConversationSummaryUpdateManyAndReturnArgs>(args: SelectSubset<T, ConversationSummaryUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ConversationSummaryPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one ConversationSummary.
     * @param {ConversationSummaryUpsertArgs} args - Arguments to update or create a ConversationSummary.
     * @example
     * // Update or create a ConversationSummary
     * const conversationSummary = await prisma.conversationSummary.upsert({
     *   create: {
     *     // ... data to create a ConversationSummary
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ConversationSummary we want to update
     *   }
     * })
     */
    upsert<T extends ConversationSummaryUpsertArgs>(args: SelectSubset<T, ConversationSummaryUpsertArgs<ExtArgs>>): Prisma__ConversationSummaryClient<$Result.GetResult<Prisma.$ConversationSummaryPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of ConversationSummaries.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ConversationSummaryCountArgs} args - Arguments to filter ConversationSummaries to count.
     * @example
     * // Count the number of ConversationSummaries
     * const count = await prisma.conversationSummary.count({
     *   where: {
     *     // ... the filter for the ConversationSummaries we want to count
     *   }
     * })
    **/
    count<T extends ConversationSummaryCountArgs>(
      args?: Subset<T, ConversationSummaryCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ConversationSummaryCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ConversationSummary.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ConversationSummaryAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ConversationSummaryAggregateArgs>(args: Subset<T, ConversationSummaryAggregateArgs>): Prisma.PrismaPromise<GetConversationSummaryAggregateType<T>>

    /**
     * Group by ConversationSummary.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ConversationSummaryGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ConversationSummaryGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ConversationSummaryGroupByArgs['orderBy'] }
        : { orderBy?: ConversationSummaryGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ConversationSummaryGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetConversationSummaryGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ConversationSummary model
   */
  readonly fields: ConversationSummaryFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ConversationSummary.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ConversationSummaryClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    session<T extends ChatSessionDefaultArgs<ExtArgs> = {}>(args?: Subset<T, ChatSessionDefaultArgs<ExtArgs>>): Prisma__ChatSessionClient<$Result.GetResult<Prisma.$ChatSessionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ConversationSummary model
   */
  interface ConversationSummaryFieldRefs {
    readonly id: FieldRef<"ConversationSummary", 'Int'>
    readonly sessionId: FieldRef<"ConversationSummary", 'Int'>
    readonly summary: FieldRef<"ConversationSummary", 'String'>
    readonly messageCount: FieldRef<"ConversationSummary", 'Int'>
    readonly createdAt: FieldRef<"ConversationSummary", 'DateTime'>
    readonly updatedAt: FieldRef<"ConversationSummary", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * ConversationSummary findUnique
   */
  export type ConversationSummaryFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConversationSummary
     */
    select?: ConversationSummarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the ConversationSummary
     */
    omit?: ConversationSummaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConversationSummaryInclude<ExtArgs> | null
    /**
     * Filter, which ConversationSummary to fetch.
     */
    where: ConversationSummaryWhereUniqueInput
  }

  /**
   * ConversationSummary findUniqueOrThrow
   */
  export type ConversationSummaryFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConversationSummary
     */
    select?: ConversationSummarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the ConversationSummary
     */
    omit?: ConversationSummaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConversationSummaryInclude<ExtArgs> | null
    /**
     * Filter, which ConversationSummary to fetch.
     */
    where: ConversationSummaryWhereUniqueInput
  }

  /**
   * ConversationSummary findFirst
   */
  export type ConversationSummaryFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConversationSummary
     */
    select?: ConversationSummarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the ConversationSummary
     */
    omit?: ConversationSummaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConversationSummaryInclude<ExtArgs> | null
    /**
     * Filter, which ConversationSummary to fetch.
     */
    where?: ConversationSummaryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ConversationSummaries to fetch.
     */
    orderBy?: ConversationSummaryOrderByWithRelationInput | ConversationSummaryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ConversationSummaries.
     */
    cursor?: ConversationSummaryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ConversationSummaries from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ConversationSummaries.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ConversationSummaries.
     */
    distinct?: ConversationSummaryScalarFieldEnum | ConversationSummaryScalarFieldEnum[]
  }

  /**
   * ConversationSummary findFirstOrThrow
   */
  export type ConversationSummaryFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConversationSummary
     */
    select?: ConversationSummarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the ConversationSummary
     */
    omit?: ConversationSummaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConversationSummaryInclude<ExtArgs> | null
    /**
     * Filter, which ConversationSummary to fetch.
     */
    where?: ConversationSummaryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ConversationSummaries to fetch.
     */
    orderBy?: ConversationSummaryOrderByWithRelationInput | ConversationSummaryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ConversationSummaries.
     */
    cursor?: ConversationSummaryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ConversationSummaries from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ConversationSummaries.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ConversationSummaries.
     */
    distinct?: ConversationSummaryScalarFieldEnum | ConversationSummaryScalarFieldEnum[]
  }

  /**
   * ConversationSummary findMany
   */
  export type ConversationSummaryFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConversationSummary
     */
    select?: ConversationSummarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the ConversationSummary
     */
    omit?: ConversationSummaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConversationSummaryInclude<ExtArgs> | null
    /**
     * Filter, which ConversationSummaries to fetch.
     */
    where?: ConversationSummaryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ConversationSummaries to fetch.
     */
    orderBy?: ConversationSummaryOrderByWithRelationInput | ConversationSummaryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ConversationSummaries.
     */
    cursor?: ConversationSummaryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ConversationSummaries from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ConversationSummaries.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ConversationSummaries.
     */
    distinct?: ConversationSummaryScalarFieldEnum | ConversationSummaryScalarFieldEnum[]
  }

  /**
   * ConversationSummary create
   */
  export type ConversationSummaryCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConversationSummary
     */
    select?: ConversationSummarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the ConversationSummary
     */
    omit?: ConversationSummaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConversationSummaryInclude<ExtArgs> | null
    /**
     * The data needed to create a ConversationSummary.
     */
    data: XOR<ConversationSummaryCreateInput, ConversationSummaryUncheckedCreateInput>
  }

  /**
   * ConversationSummary createMany
   */
  export type ConversationSummaryCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ConversationSummaries.
     */
    data: ConversationSummaryCreateManyInput | ConversationSummaryCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ConversationSummary createManyAndReturn
   */
  export type ConversationSummaryCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConversationSummary
     */
    select?: ConversationSummarySelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ConversationSummary
     */
    omit?: ConversationSummaryOmit<ExtArgs> | null
    /**
     * The data used to create many ConversationSummaries.
     */
    data: ConversationSummaryCreateManyInput | ConversationSummaryCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConversationSummaryIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * ConversationSummary update
   */
  export type ConversationSummaryUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConversationSummary
     */
    select?: ConversationSummarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the ConversationSummary
     */
    omit?: ConversationSummaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConversationSummaryInclude<ExtArgs> | null
    /**
     * The data needed to update a ConversationSummary.
     */
    data: XOR<ConversationSummaryUpdateInput, ConversationSummaryUncheckedUpdateInput>
    /**
     * Choose, which ConversationSummary to update.
     */
    where: ConversationSummaryWhereUniqueInput
  }

  /**
   * ConversationSummary updateMany
   */
  export type ConversationSummaryUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ConversationSummaries.
     */
    data: XOR<ConversationSummaryUpdateManyMutationInput, ConversationSummaryUncheckedUpdateManyInput>
    /**
     * Filter which ConversationSummaries to update
     */
    where?: ConversationSummaryWhereInput
    /**
     * Limit how many ConversationSummaries to update.
     */
    limit?: number
  }

  /**
   * ConversationSummary updateManyAndReturn
   */
  export type ConversationSummaryUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConversationSummary
     */
    select?: ConversationSummarySelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ConversationSummary
     */
    omit?: ConversationSummaryOmit<ExtArgs> | null
    /**
     * The data used to update ConversationSummaries.
     */
    data: XOR<ConversationSummaryUpdateManyMutationInput, ConversationSummaryUncheckedUpdateManyInput>
    /**
     * Filter which ConversationSummaries to update
     */
    where?: ConversationSummaryWhereInput
    /**
     * Limit how many ConversationSummaries to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConversationSummaryIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * ConversationSummary upsert
   */
  export type ConversationSummaryUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConversationSummary
     */
    select?: ConversationSummarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the ConversationSummary
     */
    omit?: ConversationSummaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConversationSummaryInclude<ExtArgs> | null
    /**
     * The filter to search for the ConversationSummary to update in case it exists.
     */
    where: ConversationSummaryWhereUniqueInput
    /**
     * In case the ConversationSummary found by the `where` argument doesn't exist, create a new ConversationSummary with this data.
     */
    create: XOR<ConversationSummaryCreateInput, ConversationSummaryUncheckedCreateInput>
    /**
     * In case the ConversationSummary was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ConversationSummaryUpdateInput, ConversationSummaryUncheckedUpdateInput>
  }

  /**
   * ConversationSummary delete
   */
  export type ConversationSummaryDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConversationSummary
     */
    select?: ConversationSummarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the ConversationSummary
     */
    omit?: ConversationSummaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConversationSummaryInclude<ExtArgs> | null
    /**
     * Filter which ConversationSummary to delete.
     */
    where: ConversationSummaryWhereUniqueInput
  }

  /**
   * ConversationSummary deleteMany
   */
  export type ConversationSummaryDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ConversationSummaries to delete
     */
    where?: ConversationSummaryWhereInput
    /**
     * Limit how many ConversationSummaries to delete.
     */
    limit?: number
  }

  /**
   * ConversationSummary without action
   */
  export type ConversationSummaryDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConversationSummary
     */
    select?: ConversationSummarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the ConversationSummary
     */
    omit?: ConversationSummaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConversationSummaryInclude<ExtArgs> | null
  }


  /**
   * Model AppConfig
   */

  export type AggregateAppConfig = {
    _count: AppConfigCountAggregateOutputType | null
    _min: AppConfigMinAggregateOutputType | null
    _max: AppConfigMaxAggregateOutputType | null
  }

  export type AppConfigMinAggregateOutputType = {
    key: string | null
    value: string | null
    updatedAt: Date | null
  }

  export type AppConfigMaxAggregateOutputType = {
    key: string | null
    value: string | null
    updatedAt: Date | null
  }

  export type AppConfigCountAggregateOutputType = {
    key: number
    value: number
    updatedAt: number
    _all: number
  }


  export type AppConfigMinAggregateInputType = {
    key?: true
    value?: true
    updatedAt?: true
  }

  export type AppConfigMaxAggregateInputType = {
    key?: true
    value?: true
    updatedAt?: true
  }

  export type AppConfigCountAggregateInputType = {
    key?: true
    value?: true
    updatedAt?: true
    _all?: true
  }

  export type AppConfigAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AppConfig to aggregate.
     */
    where?: AppConfigWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AppConfigs to fetch.
     */
    orderBy?: AppConfigOrderByWithRelationInput | AppConfigOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: AppConfigWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AppConfigs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AppConfigs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned AppConfigs
    **/
    _count?: true | AppConfigCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: AppConfigMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: AppConfigMaxAggregateInputType
  }

  export type GetAppConfigAggregateType<T extends AppConfigAggregateArgs> = {
        [P in keyof T & keyof AggregateAppConfig]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateAppConfig[P]>
      : GetScalarType<T[P], AggregateAppConfig[P]>
  }




  export type AppConfigGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AppConfigWhereInput
    orderBy?: AppConfigOrderByWithAggregationInput | AppConfigOrderByWithAggregationInput[]
    by: AppConfigScalarFieldEnum[] | AppConfigScalarFieldEnum
    having?: AppConfigScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: AppConfigCountAggregateInputType | true
    _min?: AppConfigMinAggregateInputType
    _max?: AppConfigMaxAggregateInputType
  }

  export type AppConfigGroupByOutputType = {
    key: string
    value: string
    updatedAt: Date
    _count: AppConfigCountAggregateOutputType | null
    _min: AppConfigMinAggregateOutputType | null
    _max: AppConfigMaxAggregateOutputType | null
  }

  type GetAppConfigGroupByPayload<T extends AppConfigGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<AppConfigGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof AppConfigGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], AppConfigGroupByOutputType[P]>
            : GetScalarType<T[P], AppConfigGroupByOutputType[P]>
        }
      >
    >


  export type AppConfigSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    key?: boolean
    value?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["appConfig"]>

  export type AppConfigSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    key?: boolean
    value?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["appConfig"]>

  export type AppConfigSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    key?: boolean
    value?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["appConfig"]>

  export type AppConfigSelectScalar = {
    key?: boolean
    value?: boolean
    updatedAt?: boolean
  }

  export type AppConfigOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"key" | "value" | "updatedAt", ExtArgs["result"]["appConfig"]>

  export type $AppConfigPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "AppConfig"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      key: string
      value: string
      updatedAt: Date
    }, ExtArgs["result"]["appConfig"]>
    composites: {}
  }

  type AppConfigGetPayload<S extends boolean | null | undefined | AppConfigDefaultArgs> = $Result.GetResult<Prisma.$AppConfigPayload, S>

  type AppConfigCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<AppConfigFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: AppConfigCountAggregateInputType | true
    }

  export interface AppConfigDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['AppConfig'], meta: { name: 'AppConfig' } }
    /**
     * Find zero or one AppConfig that matches the filter.
     * @param {AppConfigFindUniqueArgs} args - Arguments to find a AppConfig
     * @example
     * // Get one AppConfig
     * const appConfig = await prisma.appConfig.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends AppConfigFindUniqueArgs>(args: SelectSubset<T, AppConfigFindUniqueArgs<ExtArgs>>): Prisma__AppConfigClient<$Result.GetResult<Prisma.$AppConfigPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one AppConfig that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {AppConfigFindUniqueOrThrowArgs} args - Arguments to find a AppConfig
     * @example
     * // Get one AppConfig
     * const appConfig = await prisma.appConfig.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends AppConfigFindUniqueOrThrowArgs>(args: SelectSubset<T, AppConfigFindUniqueOrThrowArgs<ExtArgs>>): Prisma__AppConfigClient<$Result.GetResult<Prisma.$AppConfigPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first AppConfig that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AppConfigFindFirstArgs} args - Arguments to find a AppConfig
     * @example
     * // Get one AppConfig
     * const appConfig = await prisma.appConfig.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends AppConfigFindFirstArgs>(args?: SelectSubset<T, AppConfigFindFirstArgs<ExtArgs>>): Prisma__AppConfigClient<$Result.GetResult<Prisma.$AppConfigPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first AppConfig that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AppConfigFindFirstOrThrowArgs} args - Arguments to find a AppConfig
     * @example
     * // Get one AppConfig
     * const appConfig = await prisma.appConfig.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends AppConfigFindFirstOrThrowArgs>(args?: SelectSubset<T, AppConfigFindFirstOrThrowArgs<ExtArgs>>): Prisma__AppConfigClient<$Result.GetResult<Prisma.$AppConfigPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more AppConfigs that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AppConfigFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all AppConfigs
     * const appConfigs = await prisma.appConfig.findMany()
     * 
     * // Get first 10 AppConfigs
     * const appConfigs = await prisma.appConfig.findMany({ take: 10 })
     * 
     * // Only select the `key`
     * const appConfigWithKeyOnly = await prisma.appConfig.findMany({ select: { key: true } })
     * 
     */
    findMany<T extends AppConfigFindManyArgs>(args?: SelectSubset<T, AppConfigFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AppConfigPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a AppConfig.
     * @param {AppConfigCreateArgs} args - Arguments to create a AppConfig.
     * @example
     * // Create one AppConfig
     * const AppConfig = await prisma.appConfig.create({
     *   data: {
     *     // ... data to create a AppConfig
     *   }
     * })
     * 
     */
    create<T extends AppConfigCreateArgs>(args: SelectSubset<T, AppConfigCreateArgs<ExtArgs>>): Prisma__AppConfigClient<$Result.GetResult<Prisma.$AppConfigPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many AppConfigs.
     * @param {AppConfigCreateManyArgs} args - Arguments to create many AppConfigs.
     * @example
     * // Create many AppConfigs
     * const appConfig = await prisma.appConfig.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends AppConfigCreateManyArgs>(args?: SelectSubset<T, AppConfigCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many AppConfigs and returns the data saved in the database.
     * @param {AppConfigCreateManyAndReturnArgs} args - Arguments to create many AppConfigs.
     * @example
     * // Create many AppConfigs
     * const appConfig = await prisma.appConfig.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many AppConfigs and only return the `key`
     * const appConfigWithKeyOnly = await prisma.appConfig.createManyAndReturn({
     *   select: { key: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends AppConfigCreateManyAndReturnArgs>(args?: SelectSubset<T, AppConfigCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AppConfigPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a AppConfig.
     * @param {AppConfigDeleteArgs} args - Arguments to delete one AppConfig.
     * @example
     * // Delete one AppConfig
     * const AppConfig = await prisma.appConfig.delete({
     *   where: {
     *     // ... filter to delete one AppConfig
     *   }
     * })
     * 
     */
    delete<T extends AppConfigDeleteArgs>(args: SelectSubset<T, AppConfigDeleteArgs<ExtArgs>>): Prisma__AppConfigClient<$Result.GetResult<Prisma.$AppConfigPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one AppConfig.
     * @param {AppConfigUpdateArgs} args - Arguments to update one AppConfig.
     * @example
     * // Update one AppConfig
     * const appConfig = await prisma.appConfig.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends AppConfigUpdateArgs>(args: SelectSubset<T, AppConfigUpdateArgs<ExtArgs>>): Prisma__AppConfigClient<$Result.GetResult<Prisma.$AppConfigPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more AppConfigs.
     * @param {AppConfigDeleteManyArgs} args - Arguments to filter AppConfigs to delete.
     * @example
     * // Delete a few AppConfigs
     * const { count } = await prisma.appConfig.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends AppConfigDeleteManyArgs>(args?: SelectSubset<T, AppConfigDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AppConfigs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AppConfigUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many AppConfigs
     * const appConfig = await prisma.appConfig.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends AppConfigUpdateManyArgs>(args: SelectSubset<T, AppConfigUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AppConfigs and returns the data updated in the database.
     * @param {AppConfigUpdateManyAndReturnArgs} args - Arguments to update many AppConfigs.
     * @example
     * // Update many AppConfigs
     * const appConfig = await prisma.appConfig.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more AppConfigs and only return the `key`
     * const appConfigWithKeyOnly = await prisma.appConfig.updateManyAndReturn({
     *   select: { key: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends AppConfigUpdateManyAndReturnArgs>(args: SelectSubset<T, AppConfigUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AppConfigPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one AppConfig.
     * @param {AppConfigUpsertArgs} args - Arguments to update or create a AppConfig.
     * @example
     * // Update or create a AppConfig
     * const appConfig = await prisma.appConfig.upsert({
     *   create: {
     *     // ... data to create a AppConfig
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the AppConfig we want to update
     *   }
     * })
     */
    upsert<T extends AppConfigUpsertArgs>(args: SelectSubset<T, AppConfigUpsertArgs<ExtArgs>>): Prisma__AppConfigClient<$Result.GetResult<Prisma.$AppConfigPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of AppConfigs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AppConfigCountArgs} args - Arguments to filter AppConfigs to count.
     * @example
     * // Count the number of AppConfigs
     * const count = await prisma.appConfig.count({
     *   where: {
     *     // ... the filter for the AppConfigs we want to count
     *   }
     * })
    **/
    count<T extends AppConfigCountArgs>(
      args?: Subset<T, AppConfigCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], AppConfigCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a AppConfig.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AppConfigAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends AppConfigAggregateArgs>(args: Subset<T, AppConfigAggregateArgs>): Prisma.PrismaPromise<GetAppConfigAggregateType<T>>

    /**
     * Group by AppConfig.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AppConfigGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends AppConfigGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: AppConfigGroupByArgs['orderBy'] }
        : { orderBy?: AppConfigGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, AppConfigGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAppConfigGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the AppConfig model
   */
  readonly fields: AppConfigFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for AppConfig.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__AppConfigClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the AppConfig model
   */
  interface AppConfigFieldRefs {
    readonly key: FieldRef<"AppConfig", 'String'>
    readonly value: FieldRef<"AppConfig", 'String'>
    readonly updatedAt: FieldRef<"AppConfig", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * AppConfig findUnique
   */
  export type AppConfigFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AppConfig
     */
    select?: AppConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AppConfig
     */
    omit?: AppConfigOmit<ExtArgs> | null
    /**
     * Filter, which AppConfig to fetch.
     */
    where: AppConfigWhereUniqueInput
  }

  /**
   * AppConfig findUniqueOrThrow
   */
  export type AppConfigFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AppConfig
     */
    select?: AppConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AppConfig
     */
    omit?: AppConfigOmit<ExtArgs> | null
    /**
     * Filter, which AppConfig to fetch.
     */
    where: AppConfigWhereUniqueInput
  }

  /**
   * AppConfig findFirst
   */
  export type AppConfigFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AppConfig
     */
    select?: AppConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AppConfig
     */
    omit?: AppConfigOmit<ExtArgs> | null
    /**
     * Filter, which AppConfig to fetch.
     */
    where?: AppConfigWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AppConfigs to fetch.
     */
    orderBy?: AppConfigOrderByWithRelationInput | AppConfigOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AppConfigs.
     */
    cursor?: AppConfigWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AppConfigs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AppConfigs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AppConfigs.
     */
    distinct?: AppConfigScalarFieldEnum | AppConfigScalarFieldEnum[]
  }

  /**
   * AppConfig findFirstOrThrow
   */
  export type AppConfigFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AppConfig
     */
    select?: AppConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AppConfig
     */
    omit?: AppConfigOmit<ExtArgs> | null
    /**
     * Filter, which AppConfig to fetch.
     */
    where?: AppConfigWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AppConfigs to fetch.
     */
    orderBy?: AppConfigOrderByWithRelationInput | AppConfigOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AppConfigs.
     */
    cursor?: AppConfigWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AppConfigs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AppConfigs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AppConfigs.
     */
    distinct?: AppConfigScalarFieldEnum | AppConfigScalarFieldEnum[]
  }

  /**
   * AppConfig findMany
   */
  export type AppConfigFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AppConfig
     */
    select?: AppConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AppConfig
     */
    omit?: AppConfigOmit<ExtArgs> | null
    /**
     * Filter, which AppConfigs to fetch.
     */
    where?: AppConfigWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AppConfigs to fetch.
     */
    orderBy?: AppConfigOrderByWithRelationInput | AppConfigOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing AppConfigs.
     */
    cursor?: AppConfigWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AppConfigs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AppConfigs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AppConfigs.
     */
    distinct?: AppConfigScalarFieldEnum | AppConfigScalarFieldEnum[]
  }

  /**
   * AppConfig create
   */
  export type AppConfigCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AppConfig
     */
    select?: AppConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AppConfig
     */
    omit?: AppConfigOmit<ExtArgs> | null
    /**
     * The data needed to create a AppConfig.
     */
    data: XOR<AppConfigCreateInput, AppConfigUncheckedCreateInput>
  }

  /**
   * AppConfig createMany
   */
  export type AppConfigCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many AppConfigs.
     */
    data: AppConfigCreateManyInput | AppConfigCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * AppConfig createManyAndReturn
   */
  export type AppConfigCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AppConfig
     */
    select?: AppConfigSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the AppConfig
     */
    omit?: AppConfigOmit<ExtArgs> | null
    /**
     * The data used to create many AppConfigs.
     */
    data: AppConfigCreateManyInput | AppConfigCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * AppConfig update
   */
  export type AppConfigUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AppConfig
     */
    select?: AppConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AppConfig
     */
    omit?: AppConfigOmit<ExtArgs> | null
    /**
     * The data needed to update a AppConfig.
     */
    data: XOR<AppConfigUpdateInput, AppConfigUncheckedUpdateInput>
    /**
     * Choose, which AppConfig to update.
     */
    where: AppConfigWhereUniqueInput
  }

  /**
   * AppConfig updateMany
   */
  export type AppConfigUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update AppConfigs.
     */
    data: XOR<AppConfigUpdateManyMutationInput, AppConfigUncheckedUpdateManyInput>
    /**
     * Filter which AppConfigs to update
     */
    where?: AppConfigWhereInput
    /**
     * Limit how many AppConfigs to update.
     */
    limit?: number
  }

  /**
   * AppConfig updateManyAndReturn
   */
  export type AppConfigUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AppConfig
     */
    select?: AppConfigSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the AppConfig
     */
    omit?: AppConfigOmit<ExtArgs> | null
    /**
     * The data used to update AppConfigs.
     */
    data: XOR<AppConfigUpdateManyMutationInput, AppConfigUncheckedUpdateManyInput>
    /**
     * Filter which AppConfigs to update
     */
    where?: AppConfigWhereInput
    /**
     * Limit how many AppConfigs to update.
     */
    limit?: number
  }

  /**
   * AppConfig upsert
   */
  export type AppConfigUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AppConfig
     */
    select?: AppConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AppConfig
     */
    omit?: AppConfigOmit<ExtArgs> | null
    /**
     * The filter to search for the AppConfig to update in case it exists.
     */
    where: AppConfigWhereUniqueInput
    /**
     * In case the AppConfig found by the `where` argument doesn't exist, create a new AppConfig with this data.
     */
    create: XOR<AppConfigCreateInput, AppConfigUncheckedCreateInput>
    /**
     * In case the AppConfig was found with the provided `where` argument, update it with this data.
     */
    update: XOR<AppConfigUpdateInput, AppConfigUncheckedUpdateInput>
  }

  /**
   * AppConfig delete
   */
  export type AppConfigDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AppConfig
     */
    select?: AppConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AppConfig
     */
    omit?: AppConfigOmit<ExtArgs> | null
    /**
     * Filter which AppConfig to delete.
     */
    where: AppConfigWhereUniqueInput
  }

  /**
   * AppConfig deleteMany
   */
  export type AppConfigDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AppConfigs to delete
     */
    where?: AppConfigWhereInput
    /**
     * Limit how many AppConfigs to delete.
     */
    limit?: number
  }

  /**
   * AppConfig without action
   */
  export type AppConfigDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AppConfig
     */
    select?: AppConfigSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AppConfig
     */
    omit?: AppConfigOmit<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const UserScalarFieldEnum: {
    id: 'id',
    email: 'email',
    password: 'password',
    username: 'username',
    role: 'role',
    resetToken: 'resetToken',
    resetTokenExpiry: 'resetTokenExpiry',
    createdAt: 'createdAt'
  };

  export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum]


  export const UserPersonaXpScalarFieldEnum: {
    userId: 'userId',
    personaId: 'personaId',
    xp: 'xp'
  };

  export type UserPersonaXpScalarFieldEnum = (typeof UserPersonaXpScalarFieldEnum)[keyof typeof UserPersonaXpScalarFieldEnum]


  export const UserMemoryScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    content: 'content',
    category: 'category',
    createdAt: 'createdAt'
  };

  export type UserMemoryScalarFieldEnum = (typeof UserMemoryScalarFieldEnum)[keyof typeof UserMemoryScalarFieldEnum]


  export const PersonaScalarFieldEnum: {
    id: 'id',
    name: 'name',
    jobTitle: 'jobTitle',
    description: 'description',
    systemInstruction: 'systemInstruction',
    identityPrompt: 'identityPrompt',
    iconName: 'iconName',
    colorClass: 'colorClass',
    order: 'order',
    imageUrl: 'imageUrl',
    isDefault: 'isDefault',
    isVisible: 'isVisible',
    createdBy: 'createdBy',
    createdAt: 'createdAt'
  };

  export type PersonaScalarFieldEnum = (typeof PersonaScalarFieldEnum)[keyof typeof PersonaScalarFieldEnum]


  export const PersonaImageScalarFieldEnum: {
    id: 'id',
    personaId: 'personaId',
    imageUrl: 'imageUrl',
    description: 'description',
    isMain: 'isMain',
    order: 'order',
    requiredLevel: 'requiredLevel',
    createdAt: 'createdAt'
  };

  export type PersonaImageScalarFieldEnum = (typeof PersonaImageScalarFieldEnum)[keyof typeof PersonaImageScalarFieldEnum]


  export const PersonaVideoScalarFieldEnum: {
    id: 'id',
    imageId: 'imageId',
    videoUrl: 'videoUrl',
    title: 'title',
    order: 'order',
    requiredLevel: 'requiredLevel',
    createdAt: 'createdAt'
  };

  export type PersonaVideoScalarFieldEnum = (typeof PersonaVideoScalarFieldEnum)[keyof typeof PersonaVideoScalarFieldEnum]


  export const ChatSessionScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    personaId: 'personaId',
    title: 'title',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type ChatSessionScalarFieldEnum = (typeof ChatSessionScalarFieldEnum)[keyof typeof ChatSessionScalarFieldEnum]


  export const MessageScalarFieldEnum: {
    id: 'id',
    sessionId: 'sessionId',
    role: 'role',
    text: 'text',
    createdAt: 'createdAt'
  };

  export type MessageScalarFieldEnum = (typeof MessageScalarFieldEnum)[keyof typeof MessageScalarFieldEnum]


  export const ConversationSummaryScalarFieldEnum: {
    id: 'id',
    sessionId: 'sessionId',
    summary: 'summary',
    messageCount: 'messageCount',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type ConversationSummaryScalarFieldEnum = (typeof ConversationSummaryScalarFieldEnum)[keyof typeof ConversationSummaryScalarFieldEnum]


  export const AppConfigScalarFieldEnum: {
    key: 'key',
    value: 'value',
    updatedAt: 'updatedAt'
  };

  export type AppConfigScalarFieldEnum = (typeof AppConfigScalarFieldEnum)[keyof typeof AppConfigScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    
  /**
   * Deep Input Types
   */


  export type UserWhereInput = {
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    id?: IntFilter<"User"> | number
    email?: StringFilter<"User"> | string
    password?: StringFilter<"User"> | string
    username?: StringNullableFilter<"User"> | string | null
    role?: StringFilter<"User"> | string
    resetToken?: StringNullableFilter<"User"> | string | null
    resetTokenExpiry?: DateTimeNullableFilter<"User"> | Date | string | null
    createdAt?: DateTimeFilter<"User"> | Date | string
    personas?: PersonaListRelationFilter
    sessions?: ChatSessionListRelationFilter
    memories?: UserMemoryListRelationFilter
    personaXps?: UserPersonaXpListRelationFilter
  }

  export type UserOrderByWithRelationInput = {
    id?: SortOrder
    email?: SortOrder
    password?: SortOrder
    username?: SortOrderInput | SortOrder
    role?: SortOrder
    resetToken?: SortOrderInput | SortOrder
    resetTokenExpiry?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    personas?: PersonaOrderByRelationAggregateInput
    sessions?: ChatSessionOrderByRelationAggregateInput
    memories?: UserMemoryOrderByRelationAggregateInput
    personaXps?: UserPersonaXpOrderByRelationAggregateInput
  }

  export type UserWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    email?: string
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    password?: StringFilter<"User"> | string
    username?: StringNullableFilter<"User"> | string | null
    role?: StringFilter<"User"> | string
    resetToken?: StringNullableFilter<"User"> | string | null
    resetTokenExpiry?: DateTimeNullableFilter<"User"> | Date | string | null
    createdAt?: DateTimeFilter<"User"> | Date | string
    personas?: PersonaListRelationFilter
    sessions?: ChatSessionListRelationFilter
    memories?: UserMemoryListRelationFilter
    personaXps?: UserPersonaXpListRelationFilter
  }, "id" | "email">

  export type UserOrderByWithAggregationInput = {
    id?: SortOrder
    email?: SortOrder
    password?: SortOrder
    username?: SortOrderInput | SortOrder
    role?: SortOrder
    resetToken?: SortOrderInput | SortOrder
    resetTokenExpiry?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: UserCountOrderByAggregateInput
    _avg?: UserAvgOrderByAggregateInput
    _max?: UserMaxOrderByAggregateInput
    _min?: UserMinOrderByAggregateInput
    _sum?: UserSumOrderByAggregateInput
  }

  export type UserScalarWhereWithAggregatesInput = {
    AND?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    OR?: UserScalarWhereWithAggregatesInput[]
    NOT?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"User"> | number
    email?: StringWithAggregatesFilter<"User"> | string
    password?: StringWithAggregatesFilter<"User"> | string
    username?: StringNullableWithAggregatesFilter<"User"> | string | null
    role?: StringWithAggregatesFilter<"User"> | string
    resetToken?: StringNullableWithAggregatesFilter<"User"> | string | null
    resetTokenExpiry?: DateTimeNullableWithAggregatesFilter<"User"> | Date | string | null
    createdAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
  }

  export type UserPersonaXpWhereInput = {
    AND?: UserPersonaXpWhereInput | UserPersonaXpWhereInput[]
    OR?: UserPersonaXpWhereInput[]
    NOT?: UserPersonaXpWhereInput | UserPersonaXpWhereInput[]
    userId?: IntFilter<"UserPersonaXp"> | number
    personaId?: StringFilter<"UserPersonaXp"> | string
    xp?: IntFilter<"UserPersonaXp"> | number
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    persona?: XOR<PersonaScalarRelationFilter, PersonaWhereInput>
  }

  export type UserPersonaXpOrderByWithRelationInput = {
    userId?: SortOrder
    personaId?: SortOrder
    xp?: SortOrder
    user?: UserOrderByWithRelationInput
    persona?: PersonaOrderByWithRelationInput
  }

  export type UserPersonaXpWhereUniqueInput = Prisma.AtLeast<{
    userId_personaId?: UserPersonaXpUserIdPersonaIdCompoundUniqueInput
    AND?: UserPersonaXpWhereInput | UserPersonaXpWhereInput[]
    OR?: UserPersonaXpWhereInput[]
    NOT?: UserPersonaXpWhereInput | UserPersonaXpWhereInput[]
    userId?: IntFilter<"UserPersonaXp"> | number
    personaId?: StringFilter<"UserPersonaXp"> | string
    xp?: IntFilter<"UserPersonaXp"> | number
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    persona?: XOR<PersonaScalarRelationFilter, PersonaWhereInput>
  }, "userId_personaId">

  export type UserPersonaXpOrderByWithAggregationInput = {
    userId?: SortOrder
    personaId?: SortOrder
    xp?: SortOrder
    _count?: UserPersonaXpCountOrderByAggregateInput
    _avg?: UserPersonaXpAvgOrderByAggregateInput
    _max?: UserPersonaXpMaxOrderByAggregateInput
    _min?: UserPersonaXpMinOrderByAggregateInput
    _sum?: UserPersonaXpSumOrderByAggregateInput
  }

  export type UserPersonaXpScalarWhereWithAggregatesInput = {
    AND?: UserPersonaXpScalarWhereWithAggregatesInput | UserPersonaXpScalarWhereWithAggregatesInput[]
    OR?: UserPersonaXpScalarWhereWithAggregatesInput[]
    NOT?: UserPersonaXpScalarWhereWithAggregatesInput | UserPersonaXpScalarWhereWithAggregatesInput[]
    userId?: IntWithAggregatesFilter<"UserPersonaXp"> | number
    personaId?: StringWithAggregatesFilter<"UserPersonaXp"> | string
    xp?: IntWithAggregatesFilter<"UserPersonaXp"> | number
  }

  export type UserMemoryWhereInput = {
    AND?: UserMemoryWhereInput | UserMemoryWhereInput[]
    OR?: UserMemoryWhereInput[]
    NOT?: UserMemoryWhereInput | UserMemoryWhereInput[]
    id?: IntFilter<"UserMemory"> | number
    userId?: IntFilter<"UserMemory"> | number
    content?: StringFilter<"UserMemory"> | string
    category?: StringNullableFilter<"UserMemory"> | string | null
    createdAt?: DateTimeFilter<"UserMemory"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type UserMemoryOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    content?: SortOrder
    category?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type UserMemoryWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: UserMemoryWhereInput | UserMemoryWhereInput[]
    OR?: UserMemoryWhereInput[]
    NOT?: UserMemoryWhereInput | UserMemoryWhereInput[]
    userId?: IntFilter<"UserMemory"> | number
    content?: StringFilter<"UserMemory"> | string
    category?: StringNullableFilter<"UserMemory"> | string | null
    createdAt?: DateTimeFilter<"UserMemory"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "id">

  export type UserMemoryOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    content?: SortOrder
    category?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: UserMemoryCountOrderByAggregateInput
    _avg?: UserMemoryAvgOrderByAggregateInput
    _max?: UserMemoryMaxOrderByAggregateInput
    _min?: UserMemoryMinOrderByAggregateInput
    _sum?: UserMemorySumOrderByAggregateInput
  }

  export type UserMemoryScalarWhereWithAggregatesInput = {
    AND?: UserMemoryScalarWhereWithAggregatesInput | UserMemoryScalarWhereWithAggregatesInput[]
    OR?: UserMemoryScalarWhereWithAggregatesInput[]
    NOT?: UserMemoryScalarWhereWithAggregatesInput | UserMemoryScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"UserMemory"> | number
    userId?: IntWithAggregatesFilter<"UserMemory"> | number
    content?: StringWithAggregatesFilter<"UserMemory"> | string
    category?: StringNullableWithAggregatesFilter<"UserMemory"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"UserMemory"> | Date | string
  }

  export type PersonaWhereInput = {
    AND?: PersonaWhereInput | PersonaWhereInput[]
    OR?: PersonaWhereInput[]
    NOT?: PersonaWhereInput | PersonaWhereInput[]
    id?: StringFilter<"Persona"> | string
    name?: StringFilter<"Persona"> | string
    jobTitle?: StringNullableFilter<"Persona"> | string | null
    description?: StringNullableFilter<"Persona"> | string | null
    systemInstruction?: StringFilter<"Persona"> | string
    identityPrompt?: StringNullableFilter<"Persona"> | string | null
    iconName?: StringFilter<"Persona"> | string
    colorClass?: StringFilter<"Persona"> | string
    order?: IntFilter<"Persona"> | number
    imageUrl?: StringNullableFilter<"Persona"> | string | null
    isDefault?: BoolFilter<"Persona"> | boolean
    isVisible?: BoolFilter<"Persona"> | boolean
    createdBy?: IntNullableFilter<"Persona"> | number | null
    createdAt?: DateTimeFilter<"Persona"> | Date | string
    user?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null
    sessions?: ChatSessionListRelationFilter
    images?: PersonaImageListRelationFilter
    personaXps?: UserPersonaXpListRelationFilter
  }

  export type PersonaOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    jobTitle?: SortOrderInput | SortOrder
    description?: SortOrderInput | SortOrder
    systemInstruction?: SortOrder
    identityPrompt?: SortOrderInput | SortOrder
    iconName?: SortOrder
    colorClass?: SortOrder
    order?: SortOrder
    imageUrl?: SortOrderInput | SortOrder
    isDefault?: SortOrder
    isVisible?: SortOrder
    createdBy?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    user?: UserOrderByWithRelationInput
    sessions?: ChatSessionOrderByRelationAggregateInput
    images?: PersonaImageOrderByRelationAggregateInput
    personaXps?: UserPersonaXpOrderByRelationAggregateInput
  }

  export type PersonaWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: PersonaWhereInput | PersonaWhereInput[]
    OR?: PersonaWhereInput[]
    NOT?: PersonaWhereInput | PersonaWhereInput[]
    name?: StringFilter<"Persona"> | string
    jobTitle?: StringNullableFilter<"Persona"> | string | null
    description?: StringNullableFilter<"Persona"> | string | null
    systemInstruction?: StringFilter<"Persona"> | string
    identityPrompt?: StringNullableFilter<"Persona"> | string | null
    iconName?: StringFilter<"Persona"> | string
    colorClass?: StringFilter<"Persona"> | string
    order?: IntFilter<"Persona"> | number
    imageUrl?: StringNullableFilter<"Persona"> | string | null
    isDefault?: BoolFilter<"Persona"> | boolean
    isVisible?: BoolFilter<"Persona"> | boolean
    createdBy?: IntNullableFilter<"Persona"> | number | null
    createdAt?: DateTimeFilter<"Persona"> | Date | string
    user?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null
    sessions?: ChatSessionListRelationFilter
    images?: PersonaImageListRelationFilter
    personaXps?: UserPersonaXpListRelationFilter
  }, "id">

  export type PersonaOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    jobTitle?: SortOrderInput | SortOrder
    description?: SortOrderInput | SortOrder
    systemInstruction?: SortOrder
    identityPrompt?: SortOrderInput | SortOrder
    iconName?: SortOrder
    colorClass?: SortOrder
    order?: SortOrder
    imageUrl?: SortOrderInput | SortOrder
    isDefault?: SortOrder
    isVisible?: SortOrder
    createdBy?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: PersonaCountOrderByAggregateInput
    _avg?: PersonaAvgOrderByAggregateInput
    _max?: PersonaMaxOrderByAggregateInput
    _min?: PersonaMinOrderByAggregateInput
    _sum?: PersonaSumOrderByAggregateInput
  }

  export type PersonaScalarWhereWithAggregatesInput = {
    AND?: PersonaScalarWhereWithAggregatesInput | PersonaScalarWhereWithAggregatesInput[]
    OR?: PersonaScalarWhereWithAggregatesInput[]
    NOT?: PersonaScalarWhereWithAggregatesInput | PersonaScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Persona"> | string
    name?: StringWithAggregatesFilter<"Persona"> | string
    jobTitle?: StringNullableWithAggregatesFilter<"Persona"> | string | null
    description?: StringNullableWithAggregatesFilter<"Persona"> | string | null
    systemInstruction?: StringWithAggregatesFilter<"Persona"> | string
    identityPrompt?: StringNullableWithAggregatesFilter<"Persona"> | string | null
    iconName?: StringWithAggregatesFilter<"Persona"> | string
    colorClass?: StringWithAggregatesFilter<"Persona"> | string
    order?: IntWithAggregatesFilter<"Persona"> | number
    imageUrl?: StringNullableWithAggregatesFilter<"Persona"> | string | null
    isDefault?: BoolWithAggregatesFilter<"Persona"> | boolean
    isVisible?: BoolWithAggregatesFilter<"Persona"> | boolean
    createdBy?: IntNullableWithAggregatesFilter<"Persona"> | number | null
    createdAt?: DateTimeWithAggregatesFilter<"Persona"> | Date | string
  }

  export type PersonaImageWhereInput = {
    AND?: PersonaImageWhereInput | PersonaImageWhereInput[]
    OR?: PersonaImageWhereInput[]
    NOT?: PersonaImageWhereInput | PersonaImageWhereInput[]
    id?: IntFilter<"PersonaImage"> | number
    personaId?: StringFilter<"PersonaImage"> | string
    imageUrl?: StringFilter<"PersonaImage"> | string
    description?: StringNullableFilter<"PersonaImage"> | string | null
    isMain?: BoolFilter<"PersonaImage"> | boolean
    order?: IntFilter<"PersonaImage"> | number
    requiredLevel?: IntFilter<"PersonaImage"> | number
    createdAt?: DateTimeFilter<"PersonaImage"> | Date | string
    persona?: XOR<PersonaScalarRelationFilter, PersonaWhereInput>
    videos?: PersonaVideoListRelationFilter
  }

  export type PersonaImageOrderByWithRelationInput = {
    id?: SortOrder
    personaId?: SortOrder
    imageUrl?: SortOrder
    description?: SortOrderInput | SortOrder
    isMain?: SortOrder
    order?: SortOrder
    requiredLevel?: SortOrder
    createdAt?: SortOrder
    persona?: PersonaOrderByWithRelationInput
    videos?: PersonaVideoOrderByRelationAggregateInput
  }

  export type PersonaImageWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: PersonaImageWhereInput | PersonaImageWhereInput[]
    OR?: PersonaImageWhereInput[]
    NOT?: PersonaImageWhereInput | PersonaImageWhereInput[]
    personaId?: StringFilter<"PersonaImage"> | string
    imageUrl?: StringFilter<"PersonaImage"> | string
    description?: StringNullableFilter<"PersonaImage"> | string | null
    isMain?: BoolFilter<"PersonaImage"> | boolean
    order?: IntFilter<"PersonaImage"> | number
    requiredLevel?: IntFilter<"PersonaImage"> | number
    createdAt?: DateTimeFilter<"PersonaImage"> | Date | string
    persona?: XOR<PersonaScalarRelationFilter, PersonaWhereInput>
    videos?: PersonaVideoListRelationFilter
  }, "id">

  export type PersonaImageOrderByWithAggregationInput = {
    id?: SortOrder
    personaId?: SortOrder
    imageUrl?: SortOrder
    description?: SortOrderInput | SortOrder
    isMain?: SortOrder
    order?: SortOrder
    requiredLevel?: SortOrder
    createdAt?: SortOrder
    _count?: PersonaImageCountOrderByAggregateInput
    _avg?: PersonaImageAvgOrderByAggregateInput
    _max?: PersonaImageMaxOrderByAggregateInput
    _min?: PersonaImageMinOrderByAggregateInput
    _sum?: PersonaImageSumOrderByAggregateInput
  }

  export type PersonaImageScalarWhereWithAggregatesInput = {
    AND?: PersonaImageScalarWhereWithAggregatesInput | PersonaImageScalarWhereWithAggregatesInput[]
    OR?: PersonaImageScalarWhereWithAggregatesInput[]
    NOT?: PersonaImageScalarWhereWithAggregatesInput | PersonaImageScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"PersonaImage"> | number
    personaId?: StringWithAggregatesFilter<"PersonaImage"> | string
    imageUrl?: StringWithAggregatesFilter<"PersonaImage"> | string
    description?: StringNullableWithAggregatesFilter<"PersonaImage"> | string | null
    isMain?: BoolWithAggregatesFilter<"PersonaImage"> | boolean
    order?: IntWithAggregatesFilter<"PersonaImage"> | number
    requiredLevel?: IntWithAggregatesFilter<"PersonaImage"> | number
    createdAt?: DateTimeWithAggregatesFilter<"PersonaImage"> | Date | string
  }

  export type PersonaVideoWhereInput = {
    AND?: PersonaVideoWhereInput | PersonaVideoWhereInput[]
    OR?: PersonaVideoWhereInput[]
    NOT?: PersonaVideoWhereInput | PersonaVideoWhereInput[]
    id?: IntFilter<"PersonaVideo"> | number
    imageId?: IntFilter<"PersonaVideo"> | number
    videoUrl?: StringFilter<"PersonaVideo"> | string
    title?: StringNullableFilter<"PersonaVideo"> | string | null
    order?: IntFilter<"PersonaVideo"> | number
    requiredLevel?: IntFilter<"PersonaVideo"> | number
    createdAt?: DateTimeFilter<"PersonaVideo"> | Date | string
    image?: XOR<PersonaImageScalarRelationFilter, PersonaImageWhereInput>
  }

  export type PersonaVideoOrderByWithRelationInput = {
    id?: SortOrder
    imageId?: SortOrder
    videoUrl?: SortOrder
    title?: SortOrderInput | SortOrder
    order?: SortOrder
    requiredLevel?: SortOrder
    createdAt?: SortOrder
    image?: PersonaImageOrderByWithRelationInput
  }

  export type PersonaVideoWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: PersonaVideoWhereInput | PersonaVideoWhereInput[]
    OR?: PersonaVideoWhereInput[]
    NOT?: PersonaVideoWhereInput | PersonaVideoWhereInput[]
    imageId?: IntFilter<"PersonaVideo"> | number
    videoUrl?: StringFilter<"PersonaVideo"> | string
    title?: StringNullableFilter<"PersonaVideo"> | string | null
    order?: IntFilter<"PersonaVideo"> | number
    requiredLevel?: IntFilter<"PersonaVideo"> | number
    createdAt?: DateTimeFilter<"PersonaVideo"> | Date | string
    image?: XOR<PersonaImageScalarRelationFilter, PersonaImageWhereInput>
  }, "id">

  export type PersonaVideoOrderByWithAggregationInput = {
    id?: SortOrder
    imageId?: SortOrder
    videoUrl?: SortOrder
    title?: SortOrderInput | SortOrder
    order?: SortOrder
    requiredLevel?: SortOrder
    createdAt?: SortOrder
    _count?: PersonaVideoCountOrderByAggregateInput
    _avg?: PersonaVideoAvgOrderByAggregateInput
    _max?: PersonaVideoMaxOrderByAggregateInput
    _min?: PersonaVideoMinOrderByAggregateInput
    _sum?: PersonaVideoSumOrderByAggregateInput
  }

  export type PersonaVideoScalarWhereWithAggregatesInput = {
    AND?: PersonaVideoScalarWhereWithAggregatesInput | PersonaVideoScalarWhereWithAggregatesInput[]
    OR?: PersonaVideoScalarWhereWithAggregatesInput[]
    NOT?: PersonaVideoScalarWhereWithAggregatesInput | PersonaVideoScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"PersonaVideo"> | number
    imageId?: IntWithAggregatesFilter<"PersonaVideo"> | number
    videoUrl?: StringWithAggregatesFilter<"PersonaVideo"> | string
    title?: StringNullableWithAggregatesFilter<"PersonaVideo"> | string | null
    order?: IntWithAggregatesFilter<"PersonaVideo"> | number
    requiredLevel?: IntWithAggregatesFilter<"PersonaVideo"> | number
    createdAt?: DateTimeWithAggregatesFilter<"PersonaVideo"> | Date | string
  }

  export type ChatSessionWhereInput = {
    AND?: ChatSessionWhereInput | ChatSessionWhereInput[]
    OR?: ChatSessionWhereInput[]
    NOT?: ChatSessionWhereInput | ChatSessionWhereInput[]
    id?: IntFilter<"ChatSession"> | number
    userId?: IntFilter<"ChatSession"> | number
    personaId?: StringFilter<"ChatSession"> | string
    title?: StringNullableFilter<"ChatSession"> | string | null
    createdAt?: DateTimeFilter<"ChatSession"> | Date | string
    updatedAt?: DateTimeFilter<"ChatSession"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    persona?: XOR<PersonaScalarRelationFilter, PersonaWhereInput>
    messages?: MessageListRelationFilter
    summary?: XOR<ConversationSummaryNullableScalarRelationFilter, ConversationSummaryWhereInput> | null
  }

  export type ChatSessionOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    personaId?: SortOrder
    title?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    user?: UserOrderByWithRelationInput
    persona?: PersonaOrderByWithRelationInput
    messages?: MessageOrderByRelationAggregateInput
    summary?: ConversationSummaryOrderByWithRelationInput
  }

  export type ChatSessionWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: ChatSessionWhereInput | ChatSessionWhereInput[]
    OR?: ChatSessionWhereInput[]
    NOT?: ChatSessionWhereInput | ChatSessionWhereInput[]
    userId?: IntFilter<"ChatSession"> | number
    personaId?: StringFilter<"ChatSession"> | string
    title?: StringNullableFilter<"ChatSession"> | string | null
    createdAt?: DateTimeFilter<"ChatSession"> | Date | string
    updatedAt?: DateTimeFilter<"ChatSession"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    persona?: XOR<PersonaScalarRelationFilter, PersonaWhereInput>
    messages?: MessageListRelationFilter
    summary?: XOR<ConversationSummaryNullableScalarRelationFilter, ConversationSummaryWhereInput> | null
  }, "id">

  export type ChatSessionOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    personaId?: SortOrder
    title?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: ChatSessionCountOrderByAggregateInput
    _avg?: ChatSessionAvgOrderByAggregateInput
    _max?: ChatSessionMaxOrderByAggregateInput
    _min?: ChatSessionMinOrderByAggregateInput
    _sum?: ChatSessionSumOrderByAggregateInput
  }

  export type ChatSessionScalarWhereWithAggregatesInput = {
    AND?: ChatSessionScalarWhereWithAggregatesInput | ChatSessionScalarWhereWithAggregatesInput[]
    OR?: ChatSessionScalarWhereWithAggregatesInput[]
    NOT?: ChatSessionScalarWhereWithAggregatesInput | ChatSessionScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"ChatSession"> | number
    userId?: IntWithAggregatesFilter<"ChatSession"> | number
    personaId?: StringWithAggregatesFilter<"ChatSession"> | string
    title?: StringNullableWithAggregatesFilter<"ChatSession"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"ChatSession"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"ChatSession"> | Date | string
  }

  export type MessageWhereInput = {
    AND?: MessageWhereInput | MessageWhereInput[]
    OR?: MessageWhereInput[]
    NOT?: MessageWhereInput | MessageWhereInput[]
    id?: IntFilter<"Message"> | number
    sessionId?: IntFilter<"Message"> | number
    role?: StringFilter<"Message"> | string
    text?: StringFilter<"Message"> | string
    createdAt?: DateTimeFilter<"Message"> | Date | string
    session?: XOR<ChatSessionScalarRelationFilter, ChatSessionWhereInput>
  }

  export type MessageOrderByWithRelationInput = {
    id?: SortOrder
    sessionId?: SortOrder
    role?: SortOrder
    text?: SortOrder
    createdAt?: SortOrder
    session?: ChatSessionOrderByWithRelationInput
  }

  export type MessageWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: MessageWhereInput | MessageWhereInput[]
    OR?: MessageWhereInput[]
    NOT?: MessageWhereInput | MessageWhereInput[]
    sessionId?: IntFilter<"Message"> | number
    role?: StringFilter<"Message"> | string
    text?: StringFilter<"Message"> | string
    createdAt?: DateTimeFilter<"Message"> | Date | string
    session?: XOR<ChatSessionScalarRelationFilter, ChatSessionWhereInput>
  }, "id">

  export type MessageOrderByWithAggregationInput = {
    id?: SortOrder
    sessionId?: SortOrder
    role?: SortOrder
    text?: SortOrder
    createdAt?: SortOrder
    _count?: MessageCountOrderByAggregateInput
    _avg?: MessageAvgOrderByAggregateInput
    _max?: MessageMaxOrderByAggregateInput
    _min?: MessageMinOrderByAggregateInput
    _sum?: MessageSumOrderByAggregateInput
  }

  export type MessageScalarWhereWithAggregatesInput = {
    AND?: MessageScalarWhereWithAggregatesInput | MessageScalarWhereWithAggregatesInput[]
    OR?: MessageScalarWhereWithAggregatesInput[]
    NOT?: MessageScalarWhereWithAggregatesInput | MessageScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"Message"> | number
    sessionId?: IntWithAggregatesFilter<"Message"> | number
    role?: StringWithAggregatesFilter<"Message"> | string
    text?: StringWithAggregatesFilter<"Message"> | string
    createdAt?: DateTimeWithAggregatesFilter<"Message"> | Date | string
  }

  export type ConversationSummaryWhereInput = {
    AND?: ConversationSummaryWhereInput | ConversationSummaryWhereInput[]
    OR?: ConversationSummaryWhereInput[]
    NOT?: ConversationSummaryWhereInput | ConversationSummaryWhereInput[]
    id?: IntFilter<"ConversationSummary"> | number
    sessionId?: IntFilter<"ConversationSummary"> | number
    summary?: StringFilter<"ConversationSummary"> | string
    messageCount?: IntFilter<"ConversationSummary"> | number
    createdAt?: DateTimeFilter<"ConversationSummary"> | Date | string
    updatedAt?: DateTimeFilter<"ConversationSummary"> | Date | string
    session?: XOR<ChatSessionScalarRelationFilter, ChatSessionWhereInput>
  }

  export type ConversationSummaryOrderByWithRelationInput = {
    id?: SortOrder
    sessionId?: SortOrder
    summary?: SortOrder
    messageCount?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    session?: ChatSessionOrderByWithRelationInput
  }

  export type ConversationSummaryWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    sessionId?: number
    AND?: ConversationSummaryWhereInput | ConversationSummaryWhereInput[]
    OR?: ConversationSummaryWhereInput[]
    NOT?: ConversationSummaryWhereInput | ConversationSummaryWhereInput[]
    summary?: StringFilter<"ConversationSummary"> | string
    messageCount?: IntFilter<"ConversationSummary"> | number
    createdAt?: DateTimeFilter<"ConversationSummary"> | Date | string
    updatedAt?: DateTimeFilter<"ConversationSummary"> | Date | string
    session?: XOR<ChatSessionScalarRelationFilter, ChatSessionWhereInput>
  }, "id" | "sessionId">

  export type ConversationSummaryOrderByWithAggregationInput = {
    id?: SortOrder
    sessionId?: SortOrder
    summary?: SortOrder
    messageCount?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: ConversationSummaryCountOrderByAggregateInput
    _avg?: ConversationSummaryAvgOrderByAggregateInput
    _max?: ConversationSummaryMaxOrderByAggregateInput
    _min?: ConversationSummaryMinOrderByAggregateInput
    _sum?: ConversationSummarySumOrderByAggregateInput
  }

  export type ConversationSummaryScalarWhereWithAggregatesInput = {
    AND?: ConversationSummaryScalarWhereWithAggregatesInput | ConversationSummaryScalarWhereWithAggregatesInput[]
    OR?: ConversationSummaryScalarWhereWithAggregatesInput[]
    NOT?: ConversationSummaryScalarWhereWithAggregatesInput | ConversationSummaryScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"ConversationSummary"> | number
    sessionId?: IntWithAggregatesFilter<"ConversationSummary"> | number
    summary?: StringWithAggregatesFilter<"ConversationSummary"> | string
    messageCount?: IntWithAggregatesFilter<"ConversationSummary"> | number
    createdAt?: DateTimeWithAggregatesFilter<"ConversationSummary"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"ConversationSummary"> | Date | string
  }

  export type AppConfigWhereInput = {
    AND?: AppConfigWhereInput | AppConfigWhereInput[]
    OR?: AppConfigWhereInput[]
    NOT?: AppConfigWhereInput | AppConfigWhereInput[]
    key?: StringFilter<"AppConfig"> | string
    value?: StringFilter<"AppConfig"> | string
    updatedAt?: DateTimeFilter<"AppConfig"> | Date | string
  }

  export type AppConfigOrderByWithRelationInput = {
    key?: SortOrder
    value?: SortOrder
    updatedAt?: SortOrder
  }

  export type AppConfigWhereUniqueInput = Prisma.AtLeast<{
    key?: string
    AND?: AppConfigWhereInput | AppConfigWhereInput[]
    OR?: AppConfigWhereInput[]
    NOT?: AppConfigWhereInput | AppConfigWhereInput[]
    value?: StringFilter<"AppConfig"> | string
    updatedAt?: DateTimeFilter<"AppConfig"> | Date | string
  }, "key">

  export type AppConfigOrderByWithAggregationInput = {
    key?: SortOrder
    value?: SortOrder
    updatedAt?: SortOrder
    _count?: AppConfigCountOrderByAggregateInput
    _max?: AppConfigMaxOrderByAggregateInput
    _min?: AppConfigMinOrderByAggregateInput
  }

  export type AppConfigScalarWhereWithAggregatesInput = {
    AND?: AppConfigScalarWhereWithAggregatesInput | AppConfigScalarWhereWithAggregatesInput[]
    OR?: AppConfigScalarWhereWithAggregatesInput[]
    NOT?: AppConfigScalarWhereWithAggregatesInput | AppConfigScalarWhereWithAggregatesInput[]
    key?: StringWithAggregatesFilter<"AppConfig"> | string
    value?: StringWithAggregatesFilter<"AppConfig"> | string
    updatedAt?: DateTimeWithAggregatesFilter<"AppConfig"> | Date | string
  }

  export type UserCreateInput = {
    email: string
    password: string
    username?: string | null
    role?: string
    resetToken?: string | null
    resetTokenExpiry?: Date | string | null
    createdAt?: Date | string
    personas?: PersonaCreateNestedManyWithoutUserInput
    sessions?: ChatSessionCreateNestedManyWithoutUserInput
    memories?: UserMemoryCreateNestedManyWithoutUserInput
    personaXps?: UserPersonaXpCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateInput = {
    id?: number
    email: string
    password: string
    username?: string | null
    role?: string
    resetToken?: string | null
    resetTokenExpiry?: Date | string | null
    createdAt?: Date | string
    personas?: PersonaUncheckedCreateNestedManyWithoutUserInput
    sessions?: ChatSessionUncheckedCreateNestedManyWithoutUserInput
    memories?: UserMemoryUncheckedCreateNestedManyWithoutUserInput
    personaXps?: UserPersonaXpUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserUpdateInput = {
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    personas?: PersonaUpdateManyWithoutUserNestedInput
    sessions?: ChatSessionUpdateManyWithoutUserNestedInput
    memories?: UserMemoryUpdateManyWithoutUserNestedInput
    personaXps?: UserPersonaXpUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    personas?: PersonaUncheckedUpdateManyWithoutUserNestedInput
    sessions?: ChatSessionUncheckedUpdateManyWithoutUserNestedInput
    memories?: UserMemoryUncheckedUpdateManyWithoutUserNestedInput
    personaXps?: UserPersonaXpUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateManyInput = {
    id?: number
    email: string
    password: string
    username?: string | null
    role?: string
    resetToken?: string | null
    resetTokenExpiry?: Date | string | null
    createdAt?: Date | string
  }

  export type UserUpdateManyMutationInput = {
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserPersonaXpCreateInput = {
    xp?: number
    user: UserCreateNestedOneWithoutPersonaXpsInput
    persona: PersonaCreateNestedOneWithoutPersonaXpsInput
  }

  export type UserPersonaXpUncheckedCreateInput = {
    userId: number
    personaId: string
    xp?: number
  }

  export type UserPersonaXpUpdateInput = {
    xp?: IntFieldUpdateOperationsInput | number
    user?: UserUpdateOneRequiredWithoutPersonaXpsNestedInput
    persona?: PersonaUpdateOneRequiredWithoutPersonaXpsNestedInput
  }

  export type UserPersonaXpUncheckedUpdateInput = {
    userId?: IntFieldUpdateOperationsInput | number
    personaId?: StringFieldUpdateOperationsInput | string
    xp?: IntFieldUpdateOperationsInput | number
  }

  export type UserPersonaXpCreateManyInput = {
    userId: number
    personaId: string
    xp?: number
  }

  export type UserPersonaXpUpdateManyMutationInput = {
    xp?: IntFieldUpdateOperationsInput | number
  }

  export type UserPersonaXpUncheckedUpdateManyInput = {
    userId?: IntFieldUpdateOperationsInput | number
    personaId?: StringFieldUpdateOperationsInput | string
    xp?: IntFieldUpdateOperationsInput | number
  }

  export type UserMemoryCreateInput = {
    content: string
    category?: string | null
    createdAt?: Date | string
    user: UserCreateNestedOneWithoutMemoriesInput
  }

  export type UserMemoryUncheckedCreateInput = {
    id?: number
    userId: number
    content: string
    category?: string | null
    createdAt?: Date | string
  }

  export type UserMemoryUpdateInput = {
    content?: StringFieldUpdateOperationsInput | string
    category?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutMemoriesNestedInput
  }

  export type UserMemoryUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    userId?: IntFieldUpdateOperationsInput | number
    content?: StringFieldUpdateOperationsInput | string
    category?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserMemoryCreateManyInput = {
    id?: number
    userId: number
    content: string
    category?: string | null
    createdAt?: Date | string
  }

  export type UserMemoryUpdateManyMutationInput = {
    content?: StringFieldUpdateOperationsInput | string
    category?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserMemoryUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    userId?: IntFieldUpdateOperationsInput | number
    content?: StringFieldUpdateOperationsInput | string
    category?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonaCreateInput = {
    id?: string
    name: string
    jobTitle?: string | null
    description?: string | null
    systemInstruction: string
    identityPrompt?: string | null
    iconName?: string
    colorClass?: string
    order?: number
    imageUrl?: string | null
    isDefault?: boolean
    isVisible?: boolean
    createdAt?: Date | string
    user?: UserCreateNestedOneWithoutPersonasInput
    sessions?: ChatSessionCreateNestedManyWithoutPersonaInput
    images?: PersonaImageCreateNestedManyWithoutPersonaInput
    personaXps?: UserPersonaXpCreateNestedManyWithoutPersonaInput
  }

  export type PersonaUncheckedCreateInput = {
    id?: string
    name: string
    jobTitle?: string | null
    description?: string | null
    systemInstruction: string
    identityPrompt?: string | null
    iconName?: string
    colorClass?: string
    order?: number
    imageUrl?: string | null
    isDefault?: boolean
    isVisible?: boolean
    createdBy?: number | null
    createdAt?: Date | string
    sessions?: ChatSessionUncheckedCreateNestedManyWithoutPersonaInput
    images?: PersonaImageUncheckedCreateNestedManyWithoutPersonaInput
    personaXps?: UserPersonaXpUncheckedCreateNestedManyWithoutPersonaInput
  }

  export type PersonaUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    jobTitle?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    systemInstruction?: StringFieldUpdateOperationsInput | string
    identityPrompt?: NullableStringFieldUpdateOperationsInput | string | null
    iconName?: StringFieldUpdateOperationsInput | string
    colorClass?: StringFieldUpdateOperationsInput | string
    order?: IntFieldUpdateOperationsInput | number
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    isVisible?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneWithoutPersonasNestedInput
    sessions?: ChatSessionUpdateManyWithoutPersonaNestedInput
    images?: PersonaImageUpdateManyWithoutPersonaNestedInput
    personaXps?: UserPersonaXpUpdateManyWithoutPersonaNestedInput
  }

  export type PersonaUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    jobTitle?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    systemInstruction?: StringFieldUpdateOperationsInput | string
    identityPrompt?: NullableStringFieldUpdateOperationsInput | string | null
    iconName?: StringFieldUpdateOperationsInput | string
    colorClass?: StringFieldUpdateOperationsInput | string
    order?: IntFieldUpdateOperationsInput | number
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    isVisible?: BoolFieldUpdateOperationsInput | boolean
    createdBy?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: ChatSessionUncheckedUpdateManyWithoutPersonaNestedInput
    images?: PersonaImageUncheckedUpdateManyWithoutPersonaNestedInput
    personaXps?: UserPersonaXpUncheckedUpdateManyWithoutPersonaNestedInput
  }

  export type PersonaCreateManyInput = {
    id?: string
    name: string
    jobTitle?: string | null
    description?: string | null
    systemInstruction: string
    identityPrompt?: string | null
    iconName?: string
    colorClass?: string
    order?: number
    imageUrl?: string | null
    isDefault?: boolean
    isVisible?: boolean
    createdBy?: number | null
    createdAt?: Date | string
  }

  export type PersonaUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    jobTitle?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    systemInstruction?: StringFieldUpdateOperationsInput | string
    identityPrompt?: NullableStringFieldUpdateOperationsInput | string | null
    iconName?: StringFieldUpdateOperationsInput | string
    colorClass?: StringFieldUpdateOperationsInput | string
    order?: IntFieldUpdateOperationsInput | number
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    isVisible?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonaUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    jobTitle?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    systemInstruction?: StringFieldUpdateOperationsInput | string
    identityPrompt?: NullableStringFieldUpdateOperationsInput | string | null
    iconName?: StringFieldUpdateOperationsInput | string
    colorClass?: StringFieldUpdateOperationsInput | string
    order?: IntFieldUpdateOperationsInput | number
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    isVisible?: BoolFieldUpdateOperationsInput | boolean
    createdBy?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonaImageCreateInput = {
    imageUrl: string
    description?: string | null
    isMain?: boolean
    order?: number
    requiredLevel?: number
    createdAt?: Date | string
    persona: PersonaCreateNestedOneWithoutImagesInput
    videos?: PersonaVideoCreateNestedManyWithoutImageInput
  }

  export type PersonaImageUncheckedCreateInput = {
    id?: number
    personaId: string
    imageUrl: string
    description?: string | null
    isMain?: boolean
    order?: number
    requiredLevel?: number
    createdAt?: Date | string
    videos?: PersonaVideoUncheckedCreateNestedManyWithoutImageInput
  }

  export type PersonaImageUpdateInput = {
    imageUrl?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    isMain?: BoolFieldUpdateOperationsInput | boolean
    order?: IntFieldUpdateOperationsInput | number
    requiredLevel?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    persona?: PersonaUpdateOneRequiredWithoutImagesNestedInput
    videos?: PersonaVideoUpdateManyWithoutImageNestedInput
  }

  export type PersonaImageUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    personaId?: StringFieldUpdateOperationsInput | string
    imageUrl?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    isMain?: BoolFieldUpdateOperationsInput | boolean
    order?: IntFieldUpdateOperationsInput | number
    requiredLevel?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    videos?: PersonaVideoUncheckedUpdateManyWithoutImageNestedInput
  }

  export type PersonaImageCreateManyInput = {
    id?: number
    personaId: string
    imageUrl: string
    description?: string | null
    isMain?: boolean
    order?: number
    requiredLevel?: number
    createdAt?: Date | string
  }

  export type PersonaImageUpdateManyMutationInput = {
    imageUrl?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    isMain?: BoolFieldUpdateOperationsInput | boolean
    order?: IntFieldUpdateOperationsInput | number
    requiredLevel?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonaImageUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    personaId?: StringFieldUpdateOperationsInput | string
    imageUrl?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    isMain?: BoolFieldUpdateOperationsInput | boolean
    order?: IntFieldUpdateOperationsInput | number
    requiredLevel?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonaVideoCreateInput = {
    videoUrl: string
    title?: string | null
    order?: number
    requiredLevel?: number
    createdAt?: Date | string
    image: PersonaImageCreateNestedOneWithoutVideosInput
  }

  export type PersonaVideoUncheckedCreateInput = {
    id?: number
    imageId: number
    videoUrl: string
    title?: string | null
    order?: number
    requiredLevel?: number
    createdAt?: Date | string
  }

  export type PersonaVideoUpdateInput = {
    videoUrl?: StringFieldUpdateOperationsInput | string
    title?: NullableStringFieldUpdateOperationsInput | string | null
    order?: IntFieldUpdateOperationsInput | number
    requiredLevel?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    image?: PersonaImageUpdateOneRequiredWithoutVideosNestedInput
  }

  export type PersonaVideoUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    imageId?: IntFieldUpdateOperationsInput | number
    videoUrl?: StringFieldUpdateOperationsInput | string
    title?: NullableStringFieldUpdateOperationsInput | string | null
    order?: IntFieldUpdateOperationsInput | number
    requiredLevel?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonaVideoCreateManyInput = {
    id?: number
    imageId: number
    videoUrl: string
    title?: string | null
    order?: number
    requiredLevel?: number
    createdAt?: Date | string
  }

  export type PersonaVideoUpdateManyMutationInput = {
    videoUrl?: StringFieldUpdateOperationsInput | string
    title?: NullableStringFieldUpdateOperationsInput | string | null
    order?: IntFieldUpdateOperationsInput | number
    requiredLevel?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonaVideoUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    imageId?: IntFieldUpdateOperationsInput | number
    videoUrl?: StringFieldUpdateOperationsInput | string
    title?: NullableStringFieldUpdateOperationsInput | string | null
    order?: IntFieldUpdateOperationsInput | number
    requiredLevel?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ChatSessionCreateInput = {
    title?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutSessionsInput
    persona: PersonaCreateNestedOneWithoutSessionsInput
    messages?: MessageCreateNestedManyWithoutSessionInput
    summary?: ConversationSummaryCreateNestedOneWithoutSessionInput
  }

  export type ChatSessionUncheckedCreateInput = {
    id?: number
    userId: number
    personaId: string
    title?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    messages?: MessageUncheckedCreateNestedManyWithoutSessionInput
    summary?: ConversationSummaryUncheckedCreateNestedOneWithoutSessionInput
  }

  export type ChatSessionUpdateInput = {
    title?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutSessionsNestedInput
    persona?: PersonaUpdateOneRequiredWithoutSessionsNestedInput
    messages?: MessageUpdateManyWithoutSessionNestedInput
    summary?: ConversationSummaryUpdateOneWithoutSessionNestedInput
  }

  export type ChatSessionUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    userId?: IntFieldUpdateOperationsInput | number
    personaId?: StringFieldUpdateOperationsInput | string
    title?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    messages?: MessageUncheckedUpdateManyWithoutSessionNestedInput
    summary?: ConversationSummaryUncheckedUpdateOneWithoutSessionNestedInput
  }

  export type ChatSessionCreateManyInput = {
    id?: number
    userId: number
    personaId: string
    title?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ChatSessionUpdateManyMutationInput = {
    title?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ChatSessionUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    userId?: IntFieldUpdateOperationsInput | number
    personaId?: StringFieldUpdateOperationsInput | string
    title?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MessageCreateInput = {
    role: string
    text: string
    createdAt?: Date | string
    session: ChatSessionCreateNestedOneWithoutMessagesInput
  }

  export type MessageUncheckedCreateInput = {
    id?: number
    sessionId: number
    role: string
    text: string
    createdAt?: Date | string
  }

  export type MessageUpdateInput = {
    role?: StringFieldUpdateOperationsInput | string
    text?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    session?: ChatSessionUpdateOneRequiredWithoutMessagesNestedInput
  }

  export type MessageUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    sessionId?: IntFieldUpdateOperationsInput | number
    role?: StringFieldUpdateOperationsInput | string
    text?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MessageCreateManyInput = {
    id?: number
    sessionId: number
    role: string
    text: string
    createdAt?: Date | string
  }

  export type MessageUpdateManyMutationInput = {
    role?: StringFieldUpdateOperationsInput | string
    text?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MessageUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    sessionId?: IntFieldUpdateOperationsInput | number
    role?: StringFieldUpdateOperationsInput | string
    text?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ConversationSummaryCreateInput = {
    summary: string
    messageCount: number
    createdAt?: Date | string
    updatedAt?: Date | string
    session: ChatSessionCreateNestedOneWithoutSummaryInput
  }

  export type ConversationSummaryUncheckedCreateInput = {
    id?: number
    sessionId: number
    summary: string
    messageCount: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ConversationSummaryUpdateInput = {
    summary?: StringFieldUpdateOperationsInput | string
    messageCount?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    session?: ChatSessionUpdateOneRequiredWithoutSummaryNestedInput
  }

  export type ConversationSummaryUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    sessionId?: IntFieldUpdateOperationsInput | number
    summary?: StringFieldUpdateOperationsInput | string
    messageCount?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ConversationSummaryCreateManyInput = {
    id?: number
    sessionId: number
    summary: string
    messageCount: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ConversationSummaryUpdateManyMutationInput = {
    summary?: StringFieldUpdateOperationsInput | string
    messageCount?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ConversationSummaryUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    sessionId?: IntFieldUpdateOperationsInput | number
    summary?: StringFieldUpdateOperationsInput | string
    messageCount?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AppConfigCreateInput = {
    key: string
    value: string
    updatedAt?: Date | string
  }

  export type AppConfigUncheckedCreateInput = {
    key: string
    value: string
    updatedAt?: Date | string
  }

  export type AppConfigUpdateInput = {
    key?: StringFieldUpdateOperationsInput | string
    value?: StringFieldUpdateOperationsInput | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AppConfigUncheckedUpdateInput = {
    key?: StringFieldUpdateOperationsInput | string
    value?: StringFieldUpdateOperationsInput | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AppConfigCreateManyInput = {
    key: string
    value: string
    updatedAt?: Date | string
  }

  export type AppConfigUpdateManyMutationInput = {
    key?: StringFieldUpdateOperationsInput | string
    value?: StringFieldUpdateOperationsInput | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AppConfigUncheckedUpdateManyInput = {
    key?: StringFieldUpdateOperationsInput | string
    value?: StringFieldUpdateOperationsInput | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type PersonaListRelationFilter = {
    every?: PersonaWhereInput
    some?: PersonaWhereInput
    none?: PersonaWhereInput
  }

  export type ChatSessionListRelationFilter = {
    every?: ChatSessionWhereInput
    some?: ChatSessionWhereInput
    none?: ChatSessionWhereInput
  }

  export type UserMemoryListRelationFilter = {
    every?: UserMemoryWhereInput
    some?: UserMemoryWhereInput
    none?: UserMemoryWhereInput
  }

  export type UserPersonaXpListRelationFilter = {
    every?: UserPersonaXpWhereInput
    some?: UserPersonaXpWhereInput
    none?: UserPersonaXpWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type PersonaOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ChatSessionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserMemoryOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserPersonaXpOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserCountOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    password?: SortOrder
    username?: SortOrder
    role?: SortOrder
    resetToken?: SortOrder
    resetTokenExpiry?: SortOrder
    createdAt?: SortOrder
  }

  export type UserAvgOrderByAggregateInput = {
    id?: SortOrder
  }

  export type UserMaxOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    password?: SortOrder
    username?: SortOrder
    role?: SortOrder
    resetToken?: SortOrder
    resetTokenExpiry?: SortOrder
    createdAt?: SortOrder
  }

  export type UserMinOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    password?: SortOrder
    username?: SortOrder
    role?: SortOrder
    resetToken?: SortOrder
    resetTokenExpiry?: SortOrder
    createdAt?: SortOrder
  }

  export type UserSumOrderByAggregateInput = {
    id?: SortOrder
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type UserScalarRelationFilter = {
    is?: UserWhereInput
    isNot?: UserWhereInput
  }

  export type PersonaScalarRelationFilter = {
    is?: PersonaWhereInput
    isNot?: PersonaWhereInput
  }

  export type UserPersonaXpUserIdPersonaIdCompoundUniqueInput = {
    userId: number
    personaId: string
  }

  export type UserPersonaXpCountOrderByAggregateInput = {
    userId?: SortOrder
    personaId?: SortOrder
    xp?: SortOrder
  }

  export type UserPersonaXpAvgOrderByAggregateInput = {
    userId?: SortOrder
    xp?: SortOrder
  }

  export type UserPersonaXpMaxOrderByAggregateInput = {
    userId?: SortOrder
    personaId?: SortOrder
    xp?: SortOrder
  }

  export type UserPersonaXpMinOrderByAggregateInput = {
    userId?: SortOrder
    personaId?: SortOrder
    xp?: SortOrder
  }

  export type UserPersonaXpSumOrderByAggregateInput = {
    userId?: SortOrder
    xp?: SortOrder
  }

  export type UserMemoryCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    content?: SortOrder
    category?: SortOrder
    createdAt?: SortOrder
  }

  export type UserMemoryAvgOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
  }

  export type UserMemoryMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    content?: SortOrder
    category?: SortOrder
    createdAt?: SortOrder
  }

  export type UserMemoryMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    content?: SortOrder
    category?: SortOrder
    createdAt?: SortOrder
  }

  export type UserMemorySumOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type UserNullableScalarRelationFilter = {
    is?: UserWhereInput | null
    isNot?: UserWhereInput | null
  }

  export type PersonaImageListRelationFilter = {
    every?: PersonaImageWhereInput
    some?: PersonaImageWhereInput
    none?: PersonaImageWhereInput
  }

  export type PersonaImageOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type PersonaCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    jobTitle?: SortOrder
    description?: SortOrder
    systemInstruction?: SortOrder
    identityPrompt?: SortOrder
    iconName?: SortOrder
    colorClass?: SortOrder
    order?: SortOrder
    imageUrl?: SortOrder
    isDefault?: SortOrder
    isVisible?: SortOrder
    createdBy?: SortOrder
    createdAt?: SortOrder
  }

  export type PersonaAvgOrderByAggregateInput = {
    order?: SortOrder
    createdBy?: SortOrder
  }

  export type PersonaMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    jobTitle?: SortOrder
    description?: SortOrder
    systemInstruction?: SortOrder
    identityPrompt?: SortOrder
    iconName?: SortOrder
    colorClass?: SortOrder
    order?: SortOrder
    imageUrl?: SortOrder
    isDefault?: SortOrder
    isVisible?: SortOrder
    createdBy?: SortOrder
    createdAt?: SortOrder
  }

  export type PersonaMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    jobTitle?: SortOrder
    description?: SortOrder
    systemInstruction?: SortOrder
    identityPrompt?: SortOrder
    iconName?: SortOrder
    colorClass?: SortOrder
    order?: SortOrder
    imageUrl?: SortOrder
    isDefault?: SortOrder
    isVisible?: SortOrder
    createdBy?: SortOrder
    createdAt?: SortOrder
  }

  export type PersonaSumOrderByAggregateInput = {
    order?: SortOrder
    createdBy?: SortOrder
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type PersonaVideoListRelationFilter = {
    every?: PersonaVideoWhereInput
    some?: PersonaVideoWhereInput
    none?: PersonaVideoWhereInput
  }

  export type PersonaVideoOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type PersonaImageCountOrderByAggregateInput = {
    id?: SortOrder
    personaId?: SortOrder
    imageUrl?: SortOrder
    description?: SortOrder
    isMain?: SortOrder
    order?: SortOrder
    requiredLevel?: SortOrder
    createdAt?: SortOrder
  }

  export type PersonaImageAvgOrderByAggregateInput = {
    id?: SortOrder
    order?: SortOrder
    requiredLevel?: SortOrder
  }

  export type PersonaImageMaxOrderByAggregateInput = {
    id?: SortOrder
    personaId?: SortOrder
    imageUrl?: SortOrder
    description?: SortOrder
    isMain?: SortOrder
    order?: SortOrder
    requiredLevel?: SortOrder
    createdAt?: SortOrder
  }

  export type PersonaImageMinOrderByAggregateInput = {
    id?: SortOrder
    personaId?: SortOrder
    imageUrl?: SortOrder
    description?: SortOrder
    isMain?: SortOrder
    order?: SortOrder
    requiredLevel?: SortOrder
    createdAt?: SortOrder
  }

  export type PersonaImageSumOrderByAggregateInput = {
    id?: SortOrder
    order?: SortOrder
    requiredLevel?: SortOrder
  }

  export type PersonaImageScalarRelationFilter = {
    is?: PersonaImageWhereInput
    isNot?: PersonaImageWhereInput
  }

  export type PersonaVideoCountOrderByAggregateInput = {
    id?: SortOrder
    imageId?: SortOrder
    videoUrl?: SortOrder
    title?: SortOrder
    order?: SortOrder
    requiredLevel?: SortOrder
    createdAt?: SortOrder
  }

  export type PersonaVideoAvgOrderByAggregateInput = {
    id?: SortOrder
    imageId?: SortOrder
    order?: SortOrder
    requiredLevel?: SortOrder
  }

  export type PersonaVideoMaxOrderByAggregateInput = {
    id?: SortOrder
    imageId?: SortOrder
    videoUrl?: SortOrder
    title?: SortOrder
    order?: SortOrder
    requiredLevel?: SortOrder
    createdAt?: SortOrder
  }

  export type PersonaVideoMinOrderByAggregateInput = {
    id?: SortOrder
    imageId?: SortOrder
    videoUrl?: SortOrder
    title?: SortOrder
    order?: SortOrder
    requiredLevel?: SortOrder
    createdAt?: SortOrder
  }

  export type PersonaVideoSumOrderByAggregateInput = {
    id?: SortOrder
    imageId?: SortOrder
    order?: SortOrder
    requiredLevel?: SortOrder
  }

  export type MessageListRelationFilter = {
    every?: MessageWhereInput
    some?: MessageWhereInput
    none?: MessageWhereInput
  }

  export type ConversationSummaryNullableScalarRelationFilter = {
    is?: ConversationSummaryWhereInput | null
    isNot?: ConversationSummaryWhereInput | null
  }

  export type MessageOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ChatSessionCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    personaId?: SortOrder
    title?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ChatSessionAvgOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
  }

  export type ChatSessionMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    personaId?: SortOrder
    title?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ChatSessionMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    personaId?: SortOrder
    title?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ChatSessionSumOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
  }

  export type ChatSessionScalarRelationFilter = {
    is?: ChatSessionWhereInput
    isNot?: ChatSessionWhereInput
  }

  export type MessageCountOrderByAggregateInput = {
    id?: SortOrder
    sessionId?: SortOrder
    role?: SortOrder
    text?: SortOrder
    createdAt?: SortOrder
  }

  export type MessageAvgOrderByAggregateInput = {
    id?: SortOrder
    sessionId?: SortOrder
  }

  export type MessageMaxOrderByAggregateInput = {
    id?: SortOrder
    sessionId?: SortOrder
    role?: SortOrder
    text?: SortOrder
    createdAt?: SortOrder
  }

  export type MessageMinOrderByAggregateInput = {
    id?: SortOrder
    sessionId?: SortOrder
    role?: SortOrder
    text?: SortOrder
    createdAt?: SortOrder
  }

  export type MessageSumOrderByAggregateInput = {
    id?: SortOrder
    sessionId?: SortOrder
  }

  export type ConversationSummaryCountOrderByAggregateInput = {
    id?: SortOrder
    sessionId?: SortOrder
    summary?: SortOrder
    messageCount?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ConversationSummaryAvgOrderByAggregateInput = {
    id?: SortOrder
    sessionId?: SortOrder
    messageCount?: SortOrder
  }

  export type ConversationSummaryMaxOrderByAggregateInput = {
    id?: SortOrder
    sessionId?: SortOrder
    summary?: SortOrder
    messageCount?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ConversationSummaryMinOrderByAggregateInput = {
    id?: SortOrder
    sessionId?: SortOrder
    summary?: SortOrder
    messageCount?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ConversationSummarySumOrderByAggregateInput = {
    id?: SortOrder
    sessionId?: SortOrder
    messageCount?: SortOrder
  }

  export type AppConfigCountOrderByAggregateInput = {
    key?: SortOrder
    value?: SortOrder
    updatedAt?: SortOrder
  }

  export type AppConfigMaxOrderByAggregateInput = {
    key?: SortOrder
    value?: SortOrder
    updatedAt?: SortOrder
  }

  export type AppConfigMinOrderByAggregateInput = {
    key?: SortOrder
    value?: SortOrder
    updatedAt?: SortOrder
  }

  export type PersonaCreateNestedManyWithoutUserInput = {
    create?: XOR<PersonaCreateWithoutUserInput, PersonaUncheckedCreateWithoutUserInput> | PersonaCreateWithoutUserInput[] | PersonaUncheckedCreateWithoutUserInput[]
    connectOrCreate?: PersonaCreateOrConnectWithoutUserInput | PersonaCreateOrConnectWithoutUserInput[]
    createMany?: PersonaCreateManyUserInputEnvelope
    connect?: PersonaWhereUniqueInput | PersonaWhereUniqueInput[]
  }

  export type ChatSessionCreateNestedManyWithoutUserInput = {
    create?: XOR<ChatSessionCreateWithoutUserInput, ChatSessionUncheckedCreateWithoutUserInput> | ChatSessionCreateWithoutUserInput[] | ChatSessionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ChatSessionCreateOrConnectWithoutUserInput | ChatSessionCreateOrConnectWithoutUserInput[]
    createMany?: ChatSessionCreateManyUserInputEnvelope
    connect?: ChatSessionWhereUniqueInput | ChatSessionWhereUniqueInput[]
  }

  export type UserMemoryCreateNestedManyWithoutUserInput = {
    create?: XOR<UserMemoryCreateWithoutUserInput, UserMemoryUncheckedCreateWithoutUserInput> | UserMemoryCreateWithoutUserInput[] | UserMemoryUncheckedCreateWithoutUserInput[]
    connectOrCreate?: UserMemoryCreateOrConnectWithoutUserInput | UserMemoryCreateOrConnectWithoutUserInput[]
    createMany?: UserMemoryCreateManyUserInputEnvelope
    connect?: UserMemoryWhereUniqueInput | UserMemoryWhereUniqueInput[]
  }

  export type UserPersonaXpCreateNestedManyWithoutUserInput = {
    create?: XOR<UserPersonaXpCreateWithoutUserInput, UserPersonaXpUncheckedCreateWithoutUserInput> | UserPersonaXpCreateWithoutUserInput[] | UserPersonaXpUncheckedCreateWithoutUserInput[]
    connectOrCreate?: UserPersonaXpCreateOrConnectWithoutUserInput | UserPersonaXpCreateOrConnectWithoutUserInput[]
    createMany?: UserPersonaXpCreateManyUserInputEnvelope
    connect?: UserPersonaXpWhereUniqueInput | UserPersonaXpWhereUniqueInput[]
  }

  export type PersonaUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<PersonaCreateWithoutUserInput, PersonaUncheckedCreateWithoutUserInput> | PersonaCreateWithoutUserInput[] | PersonaUncheckedCreateWithoutUserInput[]
    connectOrCreate?: PersonaCreateOrConnectWithoutUserInput | PersonaCreateOrConnectWithoutUserInput[]
    createMany?: PersonaCreateManyUserInputEnvelope
    connect?: PersonaWhereUniqueInput | PersonaWhereUniqueInput[]
  }

  export type ChatSessionUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<ChatSessionCreateWithoutUserInput, ChatSessionUncheckedCreateWithoutUserInput> | ChatSessionCreateWithoutUserInput[] | ChatSessionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ChatSessionCreateOrConnectWithoutUserInput | ChatSessionCreateOrConnectWithoutUserInput[]
    createMany?: ChatSessionCreateManyUserInputEnvelope
    connect?: ChatSessionWhereUniqueInput | ChatSessionWhereUniqueInput[]
  }

  export type UserMemoryUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<UserMemoryCreateWithoutUserInput, UserMemoryUncheckedCreateWithoutUserInput> | UserMemoryCreateWithoutUserInput[] | UserMemoryUncheckedCreateWithoutUserInput[]
    connectOrCreate?: UserMemoryCreateOrConnectWithoutUserInput | UserMemoryCreateOrConnectWithoutUserInput[]
    createMany?: UserMemoryCreateManyUserInputEnvelope
    connect?: UserMemoryWhereUniqueInput | UserMemoryWhereUniqueInput[]
  }

  export type UserPersonaXpUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<UserPersonaXpCreateWithoutUserInput, UserPersonaXpUncheckedCreateWithoutUserInput> | UserPersonaXpCreateWithoutUserInput[] | UserPersonaXpUncheckedCreateWithoutUserInput[]
    connectOrCreate?: UserPersonaXpCreateOrConnectWithoutUserInput | UserPersonaXpCreateOrConnectWithoutUserInput[]
    createMany?: UserPersonaXpCreateManyUserInputEnvelope
    connect?: UserPersonaXpWhereUniqueInput | UserPersonaXpWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type PersonaUpdateManyWithoutUserNestedInput = {
    create?: XOR<PersonaCreateWithoutUserInput, PersonaUncheckedCreateWithoutUserInput> | PersonaCreateWithoutUserInput[] | PersonaUncheckedCreateWithoutUserInput[]
    connectOrCreate?: PersonaCreateOrConnectWithoutUserInput | PersonaCreateOrConnectWithoutUserInput[]
    upsert?: PersonaUpsertWithWhereUniqueWithoutUserInput | PersonaUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: PersonaCreateManyUserInputEnvelope
    set?: PersonaWhereUniqueInput | PersonaWhereUniqueInput[]
    disconnect?: PersonaWhereUniqueInput | PersonaWhereUniqueInput[]
    delete?: PersonaWhereUniqueInput | PersonaWhereUniqueInput[]
    connect?: PersonaWhereUniqueInput | PersonaWhereUniqueInput[]
    update?: PersonaUpdateWithWhereUniqueWithoutUserInput | PersonaUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: PersonaUpdateManyWithWhereWithoutUserInput | PersonaUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: PersonaScalarWhereInput | PersonaScalarWhereInput[]
  }

  export type ChatSessionUpdateManyWithoutUserNestedInput = {
    create?: XOR<ChatSessionCreateWithoutUserInput, ChatSessionUncheckedCreateWithoutUserInput> | ChatSessionCreateWithoutUserInput[] | ChatSessionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ChatSessionCreateOrConnectWithoutUserInput | ChatSessionCreateOrConnectWithoutUserInput[]
    upsert?: ChatSessionUpsertWithWhereUniqueWithoutUserInput | ChatSessionUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: ChatSessionCreateManyUserInputEnvelope
    set?: ChatSessionWhereUniqueInput | ChatSessionWhereUniqueInput[]
    disconnect?: ChatSessionWhereUniqueInput | ChatSessionWhereUniqueInput[]
    delete?: ChatSessionWhereUniqueInput | ChatSessionWhereUniqueInput[]
    connect?: ChatSessionWhereUniqueInput | ChatSessionWhereUniqueInput[]
    update?: ChatSessionUpdateWithWhereUniqueWithoutUserInput | ChatSessionUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: ChatSessionUpdateManyWithWhereWithoutUserInput | ChatSessionUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: ChatSessionScalarWhereInput | ChatSessionScalarWhereInput[]
  }

  export type UserMemoryUpdateManyWithoutUserNestedInput = {
    create?: XOR<UserMemoryCreateWithoutUserInput, UserMemoryUncheckedCreateWithoutUserInput> | UserMemoryCreateWithoutUserInput[] | UserMemoryUncheckedCreateWithoutUserInput[]
    connectOrCreate?: UserMemoryCreateOrConnectWithoutUserInput | UserMemoryCreateOrConnectWithoutUserInput[]
    upsert?: UserMemoryUpsertWithWhereUniqueWithoutUserInput | UserMemoryUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: UserMemoryCreateManyUserInputEnvelope
    set?: UserMemoryWhereUniqueInput | UserMemoryWhereUniqueInput[]
    disconnect?: UserMemoryWhereUniqueInput | UserMemoryWhereUniqueInput[]
    delete?: UserMemoryWhereUniqueInput | UserMemoryWhereUniqueInput[]
    connect?: UserMemoryWhereUniqueInput | UserMemoryWhereUniqueInput[]
    update?: UserMemoryUpdateWithWhereUniqueWithoutUserInput | UserMemoryUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: UserMemoryUpdateManyWithWhereWithoutUserInput | UserMemoryUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: UserMemoryScalarWhereInput | UserMemoryScalarWhereInput[]
  }

  export type UserPersonaXpUpdateManyWithoutUserNestedInput = {
    create?: XOR<UserPersonaXpCreateWithoutUserInput, UserPersonaXpUncheckedCreateWithoutUserInput> | UserPersonaXpCreateWithoutUserInput[] | UserPersonaXpUncheckedCreateWithoutUserInput[]
    connectOrCreate?: UserPersonaXpCreateOrConnectWithoutUserInput | UserPersonaXpCreateOrConnectWithoutUserInput[]
    upsert?: UserPersonaXpUpsertWithWhereUniqueWithoutUserInput | UserPersonaXpUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: UserPersonaXpCreateManyUserInputEnvelope
    set?: UserPersonaXpWhereUniqueInput | UserPersonaXpWhereUniqueInput[]
    disconnect?: UserPersonaXpWhereUniqueInput | UserPersonaXpWhereUniqueInput[]
    delete?: UserPersonaXpWhereUniqueInput | UserPersonaXpWhereUniqueInput[]
    connect?: UserPersonaXpWhereUniqueInput | UserPersonaXpWhereUniqueInput[]
    update?: UserPersonaXpUpdateWithWhereUniqueWithoutUserInput | UserPersonaXpUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: UserPersonaXpUpdateManyWithWhereWithoutUserInput | UserPersonaXpUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: UserPersonaXpScalarWhereInput | UserPersonaXpScalarWhereInput[]
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type PersonaUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<PersonaCreateWithoutUserInput, PersonaUncheckedCreateWithoutUserInput> | PersonaCreateWithoutUserInput[] | PersonaUncheckedCreateWithoutUserInput[]
    connectOrCreate?: PersonaCreateOrConnectWithoutUserInput | PersonaCreateOrConnectWithoutUserInput[]
    upsert?: PersonaUpsertWithWhereUniqueWithoutUserInput | PersonaUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: PersonaCreateManyUserInputEnvelope
    set?: PersonaWhereUniqueInput | PersonaWhereUniqueInput[]
    disconnect?: PersonaWhereUniqueInput | PersonaWhereUniqueInput[]
    delete?: PersonaWhereUniqueInput | PersonaWhereUniqueInput[]
    connect?: PersonaWhereUniqueInput | PersonaWhereUniqueInput[]
    update?: PersonaUpdateWithWhereUniqueWithoutUserInput | PersonaUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: PersonaUpdateManyWithWhereWithoutUserInput | PersonaUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: PersonaScalarWhereInput | PersonaScalarWhereInput[]
  }

  export type ChatSessionUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<ChatSessionCreateWithoutUserInput, ChatSessionUncheckedCreateWithoutUserInput> | ChatSessionCreateWithoutUserInput[] | ChatSessionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ChatSessionCreateOrConnectWithoutUserInput | ChatSessionCreateOrConnectWithoutUserInput[]
    upsert?: ChatSessionUpsertWithWhereUniqueWithoutUserInput | ChatSessionUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: ChatSessionCreateManyUserInputEnvelope
    set?: ChatSessionWhereUniqueInput | ChatSessionWhereUniqueInput[]
    disconnect?: ChatSessionWhereUniqueInput | ChatSessionWhereUniqueInput[]
    delete?: ChatSessionWhereUniqueInput | ChatSessionWhereUniqueInput[]
    connect?: ChatSessionWhereUniqueInput | ChatSessionWhereUniqueInput[]
    update?: ChatSessionUpdateWithWhereUniqueWithoutUserInput | ChatSessionUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: ChatSessionUpdateManyWithWhereWithoutUserInput | ChatSessionUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: ChatSessionScalarWhereInput | ChatSessionScalarWhereInput[]
  }

  export type UserMemoryUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<UserMemoryCreateWithoutUserInput, UserMemoryUncheckedCreateWithoutUserInput> | UserMemoryCreateWithoutUserInput[] | UserMemoryUncheckedCreateWithoutUserInput[]
    connectOrCreate?: UserMemoryCreateOrConnectWithoutUserInput | UserMemoryCreateOrConnectWithoutUserInput[]
    upsert?: UserMemoryUpsertWithWhereUniqueWithoutUserInput | UserMemoryUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: UserMemoryCreateManyUserInputEnvelope
    set?: UserMemoryWhereUniqueInput | UserMemoryWhereUniqueInput[]
    disconnect?: UserMemoryWhereUniqueInput | UserMemoryWhereUniqueInput[]
    delete?: UserMemoryWhereUniqueInput | UserMemoryWhereUniqueInput[]
    connect?: UserMemoryWhereUniqueInput | UserMemoryWhereUniqueInput[]
    update?: UserMemoryUpdateWithWhereUniqueWithoutUserInput | UserMemoryUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: UserMemoryUpdateManyWithWhereWithoutUserInput | UserMemoryUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: UserMemoryScalarWhereInput | UserMemoryScalarWhereInput[]
  }

  export type UserPersonaXpUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<UserPersonaXpCreateWithoutUserInput, UserPersonaXpUncheckedCreateWithoutUserInput> | UserPersonaXpCreateWithoutUserInput[] | UserPersonaXpUncheckedCreateWithoutUserInput[]
    connectOrCreate?: UserPersonaXpCreateOrConnectWithoutUserInput | UserPersonaXpCreateOrConnectWithoutUserInput[]
    upsert?: UserPersonaXpUpsertWithWhereUniqueWithoutUserInput | UserPersonaXpUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: UserPersonaXpCreateManyUserInputEnvelope
    set?: UserPersonaXpWhereUniqueInput | UserPersonaXpWhereUniqueInput[]
    disconnect?: UserPersonaXpWhereUniqueInput | UserPersonaXpWhereUniqueInput[]
    delete?: UserPersonaXpWhereUniqueInput | UserPersonaXpWhereUniqueInput[]
    connect?: UserPersonaXpWhereUniqueInput | UserPersonaXpWhereUniqueInput[]
    update?: UserPersonaXpUpdateWithWhereUniqueWithoutUserInput | UserPersonaXpUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: UserPersonaXpUpdateManyWithWhereWithoutUserInput | UserPersonaXpUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: UserPersonaXpScalarWhereInput | UserPersonaXpScalarWhereInput[]
  }

  export type UserCreateNestedOneWithoutPersonaXpsInput = {
    create?: XOR<UserCreateWithoutPersonaXpsInput, UserUncheckedCreateWithoutPersonaXpsInput>
    connectOrCreate?: UserCreateOrConnectWithoutPersonaXpsInput
    connect?: UserWhereUniqueInput
  }

  export type PersonaCreateNestedOneWithoutPersonaXpsInput = {
    create?: XOR<PersonaCreateWithoutPersonaXpsInput, PersonaUncheckedCreateWithoutPersonaXpsInput>
    connectOrCreate?: PersonaCreateOrConnectWithoutPersonaXpsInput
    connect?: PersonaWhereUniqueInput
  }

  export type UserUpdateOneRequiredWithoutPersonaXpsNestedInput = {
    create?: XOR<UserCreateWithoutPersonaXpsInput, UserUncheckedCreateWithoutPersonaXpsInput>
    connectOrCreate?: UserCreateOrConnectWithoutPersonaXpsInput
    upsert?: UserUpsertWithoutPersonaXpsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutPersonaXpsInput, UserUpdateWithoutPersonaXpsInput>, UserUncheckedUpdateWithoutPersonaXpsInput>
  }

  export type PersonaUpdateOneRequiredWithoutPersonaXpsNestedInput = {
    create?: XOR<PersonaCreateWithoutPersonaXpsInput, PersonaUncheckedCreateWithoutPersonaXpsInput>
    connectOrCreate?: PersonaCreateOrConnectWithoutPersonaXpsInput
    upsert?: PersonaUpsertWithoutPersonaXpsInput
    connect?: PersonaWhereUniqueInput
    update?: XOR<XOR<PersonaUpdateToOneWithWhereWithoutPersonaXpsInput, PersonaUpdateWithoutPersonaXpsInput>, PersonaUncheckedUpdateWithoutPersonaXpsInput>
  }

  export type UserCreateNestedOneWithoutMemoriesInput = {
    create?: XOR<UserCreateWithoutMemoriesInput, UserUncheckedCreateWithoutMemoriesInput>
    connectOrCreate?: UserCreateOrConnectWithoutMemoriesInput
    connect?: UserWhereUniqueInput
  }

  export type UserUpdateOneRequiredWithoutMemoriesNestedInput = {
    create?: XOR<UserCreateWithoutMemoriesInput, UserUncheckedCreateWithoutMemoriesInput>
    connectOrCreate?: UserCreateOrConnectWithoutMemoriesInput
    upsert?: UserUpsertWithoutMemoriesInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutMemoriesInput, UserUpdateWithoutMemoriesInput>, UserUncheckedUpdateWithoutMemoriesInput>
  }

  export type UserCreateNestedOneWithoutPersonasInput = {
    create?: XOR<UserCreateWithoutPersonasInput, UserUncheckedCreateWithoutPersonasInput>
    connectOrCreate?: UserCreateOrConnectWithoutPersonasInput
    connect?: UserWhereUniqueInput
  }

  export type ChatSessionCreateNestedManyWithoutPersonaInput = {
    create?: XOR<ChatSessionCreateWithoutPersonaInput, ChatSessionUncheckedCreateWithoutPersonaInput> | ChatSessionCreateWithoutPersonaInput[] | ChatSessionUncheckedCreateWithoutPersonaInput[]
    connectOrCreate?: ChatSessionCreateOrConnectWithoutPersonaInput | ChatSessionCreateOrConnectWithoutPersonaInput[]
    createMany?: ChatSessionCreateManyPersonaInputEnvelope
    connect?: ChatSessionWhereUniqueInput | ChatSessionWhereUniqueInput[]
  }

  export type PersonaImageCreateNestedManyWithoutPersonaInput = {
    create?: XOR<PersonaImageCreateWithoutPersonaInput, PersonaImageUncheckedCreateWithoutPersonaInput> | PersonaImageCreateWithoutPersonaInput[] | PersonaImageUncheckedCreateWithoutPersonaInput[]
    connectOrCreate?: PersonaImageCreateOrConnectWithoutPersonaInput | PersonaImageCreateOrConnectWithoutPersonaInput[]
    createMany?: PersonaImageCreateManyPersonaInputEnvelope
    connect?: PersonaImageWhereUniqueInput | PersonaImageWhereUniqueInput[]
  }

  export type UserPersonaXpCreateNestedManyWithoutPersonaInput = {
    create?: XOR<UserPersonaXpCreateWithoutPersonaInput, UserPersonaXpUncheckedCreateWithoutPersonaInput> | UserPersonaXpCreateWithoutPersonaInput[] | UserPersonaXpUncheckedCreateWithoutPersonaInput[]
    connectOrCreate?: UserPersonaXpCreateOrConnectWithoutPersonaInput | UserPersonaXpCreateOrConnectWithoutPersonaInput[]
    createMany?: UserPersonaXpCreateManyPersonaInputEnvelope
    connect?: UserPersonaXpWhereUniqueInput | UserPersonaXpWhereUniqueInput[]
  }

  export type ChatSessionUncheckedCreateNestedManyWithoutPersonaInput = {
    create?: XOR<ChatSessionCreateWithoutPersonaInput, ChatSessionUncheckedCreateWithoutPersonaInput> | ChatSessionCreateWithoutPersonaInput[] | ChatSessionUncheckedCreateWithoutPersonaInput[]
    connectOrCreate?: ChatSessionCreateOrConnectWithoutPersonaInput | ChatSessionCreateOrConnectWithoutPersonaInput[]
    createMany?: ChatSessionCreateManyPersonaInputEnvelope
    connect?: ChatSessionWhereUniqueInput | ChatSessionWhereUniqueInput[]
  }

  export type PersonaImageUncheckedCreateNestedManyWithoutPersonaInput = {
    create?: XOR<PersonaImageCreateWithoutPersonaInput, PersonaImageUncheckedCreateWithoutPersonaInput> | PersonaImageCreateWithoutPersonaInput[] | PersonaImageUncheckedCreateWithoutPersonaInput[]
    connectOrCreate?: PersonaImageCreateOrConnectWithoutPersonaInput | PersonaImageCreateOrConnectWithoutPersonaInput[]
    createMany?: PersonaImageCreateManyPersonaInputEnvelope
    connect?: PersonaImageWhereUniqueInput | PersonaImageWhereUniqueInput[]
  }

  export type UserPersonaXpUncheckedCreateNestedManyWithoutPersonaInput = {
    create?: XOR<UserPersonaXpCreateWithoutPersonaInput, UserPersonaXpUncheckedCreateWithoutPersonaInput> | UserPersonaXpCreateWithoutPersonaInput[] | UserPersonaXpUncheckedCreateWithoutPersonaInput[]
    connectOrCreate?: UserPersonaXpCreateOrConnectWithoutPersonaInput | UserPersonaXpCreateOrConnectWithoutPersonaInput[]
    createMany?: UserPersonaXpCreateManyPersonaInputEnvelope
    connect?: UserPersonaXpWhereUniqueInput | UserPersonaXpWhereUniqueInput[]
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type UserUpdateOneWithoutPersonasNestedInput = {
    create?: XOR<UserCreateWithoutPersonasInput, UserUncheckedCreateWithoutPersonasInput>
    connectOrCreate?: UserCreateOrConnectWithoutPersonasInput
    upsert?: UserUpsertWithoutPersonasInput
    disconnect?: UserWhereInput | boolean
    delete?: UserWhereInput | boolean
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutPersonasInput, UserUpdateWithoutPersonasInput>, UserUncheckedUpdateWithoutPersonasInput>
  }

  export type ChatSessionUpdateManyWithoutPersonaNestedInput = {
    create?: XOR<ChatSessionCreateWithoutPersonaInput, ChatSessionUncheckedCreateWithoutPersonaInput> | ChatSessionCreateWithoutPersonaInput[] | ChatSessionUncheckedCreateWithoutPersonaInput[]
    connectOrCreate?: ChatSessionCreateOrConnectWithoutPersonaInput | ChatSessionCreateOrConnectWithoutPersonaInput[]
    upsert?: ChatSessionUpsertWithWhereUniqueWithoutPersonaInput | ChatSessionUpsertWithWhereUniqueWithoutPersonaInput[]
    createMany?: ChatSessionCreateManyPersonaInputEnvelope
    set?: ChatSessionWhereUniqueInput | ChatSessionWhereUniqueInput[]
    disconnect?: ChatSessionWhereUniqueInput | ChatSessionWhereUniqueInput[]
    delete?: ChatSessionWhereUniqueInput | ChatSessionWhereUniqueInput[]
    connect?: ChatSessionWhereUniqueInput | ChatSessionWhereUniqueInput[]
    update?: ChatSessionUpdateWithWhereUniqueWithoutPersonaInput | ChatSessionUpdateWithWhereUniqueWithoutPersonaInput[]
    updateMany?: ChatSessionUpdateManyWithWhereWithoutPersonaInput | ChatSessionUpdateManyWithWhereWithoutPersonaInput[]
    deleteMany?: ChatSessionScalarWhereInput | ChatSessionScalarWhereInput[]
  }

  export type PersonaImageUpdateManyWithoutPersonaNestedInput = {
    create?: XOR<PersonaImageCreateWithoutPersonaInput, PersonaImageUncheckedCreateWithoutPersonaInput> | PersonaImageCreateWithoutPersonaInput[] | PersonaImageUncheckedCreateWithoutPersonaInput[]
    connectOrCreate?: PersonaImageCreateOrConnectWithoutPersonaInput | PersonaImageCreateOrConnectWithoutPersonaInput[]
    upsert?: PersonaImageUpsertWithWhereUniqueWithoutPersonaInput | PersonaImageUpsertWithWhereUniqueWithoutPersonaInput[]
    createMany?: PersonaImageCreateManyPersonaInputEnvelope
    set?: PersonaImageWhereUniqueInput | PersonaImageWhereUniqueInput[]
    disconnect?: PersonaImageWhereUniqueInput | PersonaImageWhereUniqueInput[]
    delete?: PersonaImageWhereUniqueInput | PersonaImageWhereUniqueInput[]
    connect?: PersonaImageWhereUniqueInput | PersonaImageWhereUniqueInput[]
    update?: PersonaImageUpdateWithWhereUniqueWithoutPersonaInput | PersonaImageUpdateWithWhereUniqueWithoutPersonaInput[]
    updateMany?: PersonaImageUpdateManyWithWhereWithoutPersonaInput | PersonaImageUpdateManyWithWhereWithoutPersonaInput[]
    deleteMany?: PersonaImageScalarWhereInput | PersonaImageScalarWhereInput[]
  }

  export type UserPersonaXpUpdateManyWithoutPersonaNestedInput = {
    create?: XOR<UserPersonaXpCreateWithoutPersonaInput, UserPersonaXpUncheckedCreateWithoutPersonaInput> | UserPersonaXpCreateWithoutPersonaInput[] | UserPersonaXpUncheckedCreateWithoutPersonaInput[]
    connectOrCreate?: UserPersonaXpCreateOrConnectWithoutPersonaInput | UserPersonaXpCreateOrConnectWithoutPersonaInput[]
    upsert?: UserPersonaXpUpsertWithWhereUniqueWithoutPersonaInput | UserPersonaXpUpsertWithWhereUniqueWithoutPersonaInput[]
    createMany?: UserPersonaXpCreateManyPersonaInputEnvelope
    set?: UserPersonaXpWhereUniqueInput | UserPersonaXpWhereUniqueInput[]
    disconnect?: UserPersonaXpWhereUniqueInput | UserPersonaXpWhereUniqueInput[]
    delete?: UserPersonaXpWhereUniqueInput | UserPersonaXpWhereUniqueInput[]
    connect?: UserPersonaXpWhereUniqueInput | UserPersonaXpWhereUniqueInput[]
    update?: UserPersonaXpUpdateWithWhereUniqueWithoutPersonaInput | UserPersonaXpUpdateWithWhereUniqueWithoutPersonaInput[]
    updateMany?: UserPersonaXpUpdateManyWithWhereWithoutPersonaInput | UserPersonaXpUpdateManyWithWhereWithoutPersonaInput[]
    deleteMany?: UserPersonaXpScalarWhereInput | UserPersonaXpScalarWhereInput[]
  }

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type ChatSessionUncheckedUpdateManyWithoutPersonaNestedInput = {
    create?: XOR<ChatSessionCreateWithoutPersonaInput, ChatSessionUncheckedCreateWithoutPersonaInput> | ChatSessionCreateWithoutPersonaInput[] | ChatSessionUncheckedCreateWithoutPersonaInput[]
    connectOrCreate?: ChatSessionCreateOrConnectWithoutPersonaInput | ChatSessionCreateOrConnectWithoutPersonaInput[]
    upsert?: ChatSessionUpsertWithWhereUniqueWithoutPersonaInput | ChatSessionUpsertWithWhereUniqueWithoutPersonaInput[]
    createMany?: ChatSessionCreateManyPersonaInputEnvelope
    set?: ChatSessionWhereUniqueInput | ChatSessionWhereUniqueInput[]
    disconnect?: ChatSessionWhereUniqueInput | ChatSessionWhereUniqueInput[]
    delete?: ChatSessionWhereUniqueInput | ChatSessionWhereUniqueInput[]
    connect?: ChatSessionWhereUniqueInput | ChatSessionWhereUniqueInput[]
    update?: ChatSessionUpdateWithWhereUniqueWithoutPersonaInput | ChatSessionUpdateWithWhereUniqueWithoutPersonaInput[]
    updateMany?: ChatSessionUpdateManyWithWhereWithoutPersonaInput | ChatSessionUpdateManyWithWhereWithoutPersonaInput[]
    deleteMany?: ChatSessionScalarWhereInput | ChatSessionScalarWhereInput[]
  }

  export type PersonaImageUncheckedUpdateManyWithoutPersonaNestedInput = {
    create?: XOR<PersonaImageCreateWithoutPersonaInput, PersonaImageUncheckedCreateWithoutPersonaInput> | PersonaImageCreateWithoutPersonaInput[] | PersonaImageUncheckedCreateWithoutPersonaInput[]
    connectOrCreate?: PersonaImageCreateOrConnectWithoutPersonaInput | PersonaImageCreateOrConnectWithoutPersonaInput[]
    upsert?: PersonaImageUpsertWithWhereUniqueWithoutPersonaInput | PersonaImageUpsertWithWhereUniqueWithoutPersonaInput[]
    createMany?: PersonaImageCreateManyPersonaInputEnvelope
    set?: PersonaImageWhereUniqueInput | PersonaImageWhereUniqueInput[]
    disconnect?: PersonaImageWhereUniqueInput | PersonaImageWhereUniqueInput[]
    delete?: PersonaImageWhereUniqueInput | PersonaImageWhereUniqueInput[]
    connect?: PersonaImageWhereUniqueInput | PersonaImageWhereUniqueInput[]
    update?: PersonaImageUpdateWithWhereUniqueWithoutPersonaInput | PersonaImageUpdateWithWhereUniqueWithoutPersonaInput[]
    updateMany?: PersonaImageUpdateManyWithWhereWithoutPersonaInput | PersonaImageUpdateManyWithWhereWithoutPersonaInput[]
    deleteMany?: PersonaImageScalarWhereInput | PersonaImageScalarWhereInput[]
  }

  export type UserPersonaXpUncheckedUpdateManyWithoutPersonaNestedInput = {
    create?: XOR<UserPersonaXpCreateWithoutPersonaInput, UserPersonaXpUncheckedCreateWithoutPersonaInput> | UserPersonaXpCreateWithoutPersonaInput[] | UserPersonaXpUncheckedCreateWithoutPersonaInput[]
    connectOrCreate?: UserPersonaXpCreateOrConnectWithoutPersonaInput | UserPersonaXpCreateOrConnectWithoutPersonaInput[]
    upsert?: UserPersonaXpUpsertWithWhereUniqueWithoutPersonaInput | UserPersonaXpUpsertWithWhereUniqueWithoutPersonaInput[]
    createMany?: UserPersonaXpCreateManyPersonaInputEnvelope
    set?: UserPersonaXpWhereUniqueInput | UserPersonaXpWhereUniqueInput[]
    disconnect?: UserPersonaXpWhereUniqueInput | UserPersonaXpWhereUniqueInput[]
    delete?: UserPersonaXpWhereUniqueInput | UserPersonaXpWhereUniqueInput[]
    connect?: UserPersonaXpWhereUniqueInput | UserPersonaXpWhereUniqueInput[]
    update?: UserPersonaXpUpdateWithWhereUniqueWithoutPersonaInput | UserPersonaXpUpdateWithWhereUniqueWithoutPersonaInput[]
    updateMany?: UserPersonaXpUpdateManyWithWhereWithoutPersonaInput | UserPersonaXpUpdateManyWithWhereWithoutPersonaInput[]
    deleteMany?: UserPersonaXpScalarWhereInput | UserPersonaXpScalarWhereInput[]
  }

  export type PersonaCreateNestedOneWithoutImagesInput = {
    create?: XOR<PersonaCreateWithoutImagesInput, PersonaUncheckedCreateWithoutImagesInput>
    connectOrCreate?: PersonaCreateOrConnectWithoutImagesInput
    connect?: PersonaWhereUniqueInput
  }

  export type PersonaVideoCreateNestedManyWithoutImageInput = {
    create?: XOR<PersonaVideoCreateWithoutImageInput, PersonaVideoUncheckedCreateWithoutImageInput> | PersonaVideoCreateWithoutImageInput[] | PersonaVideoUncheckedCreateWithoutImageInput[]
    connectOrCreate?: PersonaVideoCreateOrConnectWithoutImageInput | PersonaVideoCreateOrConnectWithoutImageInput[]
    createMany?: PersonaVideoCreateManyImageInputEnvelope
    connect?: PersonaVideoWhereUniqueInput | PersonaVideoWhereUniqueInput[]
  }

  export type PersonaVideoUncheckedCreateNestedManyWithoutImageInput = {
    create?: XOR<PersonaVideoCreateWithoutImageInput, PersonaVideoUncheckedCreateWithoutImageInput> | PersonaVideoCreateWithoutImageInput[] | PersonaVideoUncheckedCreateWithoutImageInput[]
    connectOrCreate?: PersonaVideoCreateOrConnectWithoutImageInput | PersonaVideoCreateOrConnectWithoutImageInput[]
    createMany?: PersonaVideoCreateManyImageInputEnvelope
    connect?: PersonaVideoWhereUniqueInput | PersonaVideoWhereUniqueInput[]
  }

  export type PersonaUpdateOneRequiredWithoutImagesNestedInput = {
    create?: XOR<PersonaCreateWithoutImagesInput, PersonaUncheckedCreateWithoutImagesInput>
    connectOrCreate?: PersonaCreateOrConnectWithoutImagesInput
    upsert?: PersonaUpsertWithoutImagesInput
    connect?: PersonaWhereUniqueInput
    update?: XOR<XOR<PersonaUpdateToOneWithWhereWithoutImagesInput, PersonaUpdateWithoutImagesInput>, PersonaUncheckedUpdateWithoutImagesInput>
  }

  export type PersonaVideoUpdateManyWithoutImageNestedInput = {
    create?: XOR<PersonaVideoCreateWithoutImageInput, PersonaVideoUncheckedCreateWithoutImageInput> | PersonaVideoCreateWithoutImageInput[] | PersonaVideoUncheckedCreateWithoutImageInput[]
    connectOrCreate?: PersonaVideoCreateOrConnectWithoutImageInput | PersonaVideoCreateOrConnectWithoutImageInput[]
    upsert?: PersonaVideoUpsertWithWhereUniqueWithoutImageInput | PersonaVideoUpsertWithWhereUniqueWithoutImageInput[]
    createMany?: PersonaVideoCreateManyImageInputEnvelope
    set?: PersonaVideoWhereUniqueInput | PersonaVideoWhereUniqueInput[]
    disconnect?: PersonaVideoWhereUniqueInput | PersonaVideoWhereUniqueInput[]
    delete?: PersonaVideoWhereUniqueInput | PersonaVideoWhereUniqueInput[]
    connect?: PersonaVideoWhereUniqueInput | PersonaVideoWhereUniqueInput[]
    update?: PersonaVideoUpdateWithWhereUniqueWithoutImageInput | PersonaVideoUpdateWithWhereUniqueWithoutImageInput[]
    updateMany?: PersonaVideoUpdateManyWithWhereWithoutImageInput | PersonaVideoUpdateManyWithWhereWithoutImageInput[]
    deleteMany?: PersonaVideoScalarWhereInput | PersonaVideoScalarWhereInput[]
  }

  export type PersonaVideoUncheckedUpdateManyWithoutImageNestedInput = {
    create?: XOR<PersonaVideoCreateWithoutImageInput, PersonaVideoUncheckedCreateWithoutImageInput> | PersonaVideoCreateWithoutImageInput[] | PersonaVideoUncheckedCreateWithoutImageInput[]
    connectOrCreate?: PersonaVideoCreateOrConnectWithoutImageInput | PersonaVideoCreateOrConnectWithoutImageInput[]
    upsert?: PersonaVideoUpsertWithWhereUniqueWithoutImageInput | PersonaVideoUpsertWithWhereUniqueWithoutImageInput[]
    createMany?: PersonaVideoCreateManyImageInputEnvelope
    set?: PersonaVideoWhereUniqueInput | PersonaVideoWhereUniqueInput[]
    disconnect?: PersonaVideoWhereUniqueInput | PersonaVideoWhereUniqueInput[]
    delete?: PersonaVideoWhereUniqueInput | PersonaVideoWhereUniqueInput[]
    connect?: PersonaVideoWhereUniqueInput | PersonaVideoWhereUniqueInput[]
    update?: PersonaVideoUpdateWithWhereUniqueWithoutImageInput | PersonaVideoUpdateWithWhereUniqueWithoutImageInput[]
    updateMany?: PersonaVideoUpdateManyWithWhereWithoutImageInput | PersonaVideoUpdateManyWithWhereWithoutImageInput[]
    deleteMany?: PersonaVideoScalarWhereInput | PersonaVideoScalarWhereInput[]
  }

  export type PersonaImageCreateNestedOneWithoutVideosInput = {
    create?: XOR<PersonaImageCreateWithoutVideosInput, PersonaImageUncheckedCreateWithoutVideosInput>
    connectOrCreate?: PersonaImageCreateOrConnectWithoutVideosInput
    connect?: PersonaImageWhereUniqueInput
  }

  export type PersonaImageUpdateOneRequiredWithoutVideosNestedInput = {
    create?: XOR<PersonaImageCreateWithoutVideosInput, PersonaImageUncheckedCreateWithoutVideosInput>
    connectOrCreate?: PersonaImageCreateOrConnectWithoutVideosInput
    upsert?: PersonaImageUpsertWithoutVideosInput
    connect?: PersonaImageWhereUniqueInput
    update?: XOR<XOR<PersonaImageUpdateToOneWithWhereWithoutVideosInput, PersonaImageUpdateWithoutVideosInput>, PersonaImageUncheckedUpdateWithoutVideosInput>
  }

  export type UserCreateNestedOneWithoutSessionsInput = {
    create?: XOR<UserCreateWithoutSessionsInput, UserUncheckedCreateWithoutSessionsInput>
    connectOrCreate?: UserCreateOrConnectWithoutSessionsInput
    connect?: UserWhereUniqueInput
  }

  export type PersonaCreateNestedOneWithoutSessionsInput = {
    create?: XOR<PersonaCreateWithoutSessionsInput, PersonaUncheckedCreateWithoutSessionsInput>
    connectOrCreate?: PersonaCreateOrConnectWithoutSessionsInput
    connect?: PersonaWhereUniqueInput
  }

  export type MessageCreateNestedManyWithoutSessionInput = {
    create?: XOR<MessageCreateWithoutSessionInput, MessageUncheckedCreateWithoutSessionInput> | MessageCreateWithoutSessionInput[] | MessageUncheckedCreateWithoutSessionInput[]
    connectOrCreate?: MessageCreateOrConnectWithoutSessionInput | MessageCreateOrConnectWithoutSessionInput[]
    createMany?: MessageCreateManySessionInputEnvelope
    connect?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
  }

  export type ConversationSummaryCreateNestedOneWithoutSessionInput = {
    create?: XOR<ConversationSummaryCreateWithoutSessionInput, ConversationSummaryUncheckedCreateWithoutSessionInput>
    connectOrCreate?: ConversationSummaryCreateOrConnectWithoutSessionInput
    connect?: ConversationSummaryWhereUniqueInput
  }

  export type MessageUncheckedCreateNestedManyWithoutSessionInput = {
    create?: XOR<MessageCreateWithoutSessionInput, MessageUncheckedCreateWithoutSessionInput> | MessageCreateWithoutSessionInput[] | MessageUncheckedCreateWithoutSessionInput[]
    connectOrCreate?: MessageCreateOrConnectWithoutSessionInput | MessageCreateOrConnectWithoutSessionInput[]
    createMany?: MessageCreateManySessionInputEnvelope
    connect?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
  }

  export type ConversationSummaryUncheckedCreateNestedOneWithoutSessionInput = {
    create?: XOR<ConversationSummaryCreateWithoutSessionInput, ConversationSummaryUncheckedCreateWithoutSessionInput>
    connectOrCreate?: ConversationSummaryCreateOrConnectWithoutSessionInput
    connect?: ConversationSummaryWhereUniqueInput
  }

  export type UserUpdateOneRequiredWithoutSessionsNestedInput = {
    create?: XOR<UserCreateWithoutSessionsInput, UserUncheckedCreateWithoutSessionsInput>
    connectOrCreate?: UserCreateOrConnectWithoutSessionsInput
    upsert?: UserUpsertWithoutSessionsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutSessionsInput, UserUpdateWithoutSessionsInput>, UserUncheckedUpdateWithoutSessionsInput>
  }

  export type PersonaUpdateOneRequiredWithoutSessionsNestedInput = {
    create?: XOR<PersonaCreateWithoutSessionsInput, PersonaUncheckedCreateWithoutSessionsInput>
    connectOrCreate?: PersonaCreateOrConnectWithoutSessionsInput
    upsert?: PersonaUpsertWithoutSessionsInput
    connect?: PersonaWhereUniqueInput
    update?: XOR<XOR<PersonaUpdateToOneWithWhereWithoutSessionsInput, PersonaUpdateWithoutSessionsInput>, PersonaUncheckedUpdateWithoutSessionsInput>
  }

  export type MessageUpdateManyWithoutSessionNestedInput = {
    create?: XOR<MessageCreateWithoutSessionInput, MessageUncheckedCreateWithoutSessionInput> | MessageCreateWithoutSessionInput[] | MessageUncheckedCreateWithoutSessionInput[]
    connectOrCreate?: MessageCreateOrConnectWithoutSessionInput | MessageCreateOrConnectWithoutSessionInput[]
    upsert?: MessageUpsertWithWhereUniqueWithoutSessionInput | MessageUpsertWithWhereUniqueWithoutSessionInput[]
    createMany?: MessageCreateManySessionInputEnvelope
    set?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
    disconnect?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
    delete?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
    connect?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
    update?: MessageUpdateWithWhereUniqueWithoutSessionInput | MessageUpdateWithWhereUniqueWithoutSessionInput[]
    updateMany?: MessageUpdateManyWithWhereWithoutSessionInput | MessageUpdateManyWithWhereWithoutSessionInput[]
    deleteMany?: MessageScalarWhereInput | MessageScalarWhereInput[]
  }

  export type ConversationSummaryUpdateOneWithoutSessionNestedInput = {
    create?: XOR<ConversationSummaryCreateWithoutSessionInput, ConversationSummaryUncheckedCreateWithoutSessionInput>
    connectOrCreate?: ConversationSummaryCreateOrConnectWithoutSessionInput
    upsert?: ConversationSummaryUpsertWithoutSessionInput
    disconnect?: ConversationSummaryWhereInput | boolean
    delete?: ConversationSummaryWhereInput | boolean
    connect?: ConversationSummaryWhereUniqueInput
    update?: XOR<XOR<ConversationSummaryUpdateToOneWithWhereWithoutSessionInput, ConversationSummaryUpdateWithoutSessionInput>, ConversationSummaryUncheckedUpdateWithoutSessionInput>
  }

  export type MessageUncheckedUpdateManyWithoutSessionNestedInput = {
    create?: XOR<MessageCreateWithoutSessionInput, MessageUncheckedCreateWithoutSessionInput> | MessageCreateWithoutSessionInput[] | MessageUncheckedCreateWithoutSessionInput[]
    connectOrCreate?: MessageCreateOrConnectWithoutSessionInput | MessageCreateOrConnectWithoutSessionInput[]
    upsert?: MessageUpsertWithWhereUniqueWithoutSessionInput | MessageUpsertWithWhereUniqueWithoutSessionInput[]
    createMany?: MessageCreateManySessionInputEnvelope
    set?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
    disconnect?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
    delete?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
    connect?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
    update?: MessageUpdateWithWhereUniqueWithoutSessionInput | MessageUpdateWithWhereUniqueWithoutSessionInput[]
    updateMany?: MessageUpdateManyWithWhereWithoutSessionInput | MessageUpdateManyWithWhereWithoutSessionInput[]
    deleteMany?: MessageScalarWhereInput | MessageScalarWhereInput[]
  }

  export type ConversationSummaryUncheckedUpdateOneWithoutSessionNestedInput = {
    create?: XOR<ConversationSummaryCreateWithoutSessionInput, ConversationSummaryUncheckedCreateWithoutSessionInput>
    connectOrCreate?: ConversationSummaryCreateOrConnectWithoutSessionInput
    upsert?: ConversationSummaryUpsertWithoutSessionInput
    disconnect?: ConversationSummaryWhereInput | boolean
    delete?: ConversationSummaryWhereInput | boolean
    connect?: ConversationSummaryWhereUniqueInput
    update?: XOR<XOR<ConversationSummaryUpdateToOneWithWhereWithoutSessionInput, ConversationSummaryUpdateWithoutSessionInput>, ConversationSummaryUncheckedUpdateWithoutSessionInput>
  }

  export type ChatSessionCreateNestedOneWithoutMessagesInput = {
    create?: XOR<ChatSessionCreateWithoutMessagesInput, ChatSessionUncheckedCreateWithoutMessagesInput>
    connectOrCreate?: ChatSessionCreateOrConnectWithoutMessagesInput
    connect?: ChatSessionWhereUniqueInput
  }

  export type ChatSessionUpdateOneRequiredWithoutMessagesNestedInput = {
    create?: XOR<ChatSessionCreateWithoutMessagesInput, ChatSessionUncheckedCreateWithoutMessagesInput>
    connectOrCreate?: ChatSessionCreateOrConnectWithoutMessagesInput
    upsert?: ChatSessionUpsertWithoutMessagesInput
    connect?: ChatSessionWhereUniqueInput
    update?: XOR<XOR<ChatSessionUpdateToOneWithWhereWithoutMessagesInput, ChatSessionUpdateWithoutMessagesInput>, ChatSessionUncheckedUpdateWithoutMessagesInput>
  }

  export type ChatSessionCreateNestedOneWithoutSummaryInput = {
    create?: XOR<ChatSessionCreateWithoutSummaryInput, ChatSessionUncheckedCreateWithoutSummaryInput>
    connectOrCreate?: ChatSessionCreateOrConnectWithoutSummaryInput
    connect?: ChatSessionWhereUniqueInput
  }

  export type ChatSessionUpdateOneRequiredWithoutSummaryNestedInput = {
    create?: XOR<ChatSessionCreateWithoutSummaryInput, ChatSessionUncheckedCreateWithoutSummaryInput>
    connectOrCreate?: ChatSessionCreateOrConnectWithoutSummaryInput
    upsert?: ChatSessionUpsertWithoutSummaryInput
    connect?: ChatSessionWhereUniqueInput
    update?: XOR<XOR<ChatSessionUpdateToOneWithWhereWithoutSummaryInput, ChatSessionUpdateWithoutSummaryInput>, ChatSessionUncheckedUpdateWithoutSummaryInput>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type PersonaCreateWithoutUserInput = {
    id?: string
    name: string
    jobTitle?: string | null
    description?: string | null
    systemInstruction: string
    identityPrompt?: string | null
    iconName?: string
    colorClass?: string
    order?: number
    imageUrl?: string | null
    isDefault?: boolean
    isVisible?: boolean
    createdAt?: Date | string
    sessions?: ChatSessionCreateNestedManyWithoutPersonaInput
    images?: PersonaImageCreateNestedManyWithoutPersonaInput
    personaXps?: UserPersonaXpCreateNestedManyWithoutPersonaInput
  }

  export type PersonaUncheckedCreateWithoutUserInput = {
    id?: string
    name: string
    jobTitle?: string | null
    description?: string | null
    systemInstruction: string
    identityPrompt?: string | null
    iconName?: string
    colorClass?: string
    order?: number
    imageUrl?: string | null
    isDefault?: boolean
    isVisible?: boolean
    createdAt?: Date | string
    sessions?: ChatSessionUncheckedCreateNestedManyWithoutPersonaInput
    images?: PersonaImageUncheckedCreateNestedManyWithoutPersonaInput
    personaXps?: UserPersonaXpUncheckedCreateNestedManyWithoutPersonaInput
  }

  export type PersonaCreateOrConnectWithoutUserInput = {
    where: PersonaWhereUniqueInput
    create: XOR<PersonaCreateWithoutUserInput, PersonaUncheckedCreateWithoutUserInput>
  }

  export type PersonaCreateManyUserInputEnvelope = {
    data: PersonaCreateManyUserInput | PersonaCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type ChatSessionCreateWithoutUserInput = {
    title?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    persona: PersonaCreateNestedOneWithoutSessionsInput
    messages?: MessageCreateNestedManyWithoutSessionInput
    summary?: ConversationSummaryCreateNestedOneWithoutSessionInput
  }

  export type ChatSessionUncheckedCreateWithoutUserInput = {
    id?: number
    personaId: string
    title?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    messages?: MessageUncheckedCreateNestedManyWithoutSessionInput
    summary?: ConversationSummaryUncheckedCreateNestedOneWithoutSessionInput
  }

  export type ChatSessionCreateOrConnectWithoutUserInput = {
    where: ChatSessionWhereUniqueInput
    create: XOR<ChatSessionCreateWithoutUserInput, ChatSessionUncheckedCreateWithoutUserInput>
  }

  export type ChatSessionCreateManyUserInputEnvelope = {
    data: ChatSessionCreateManyUserInput | ChatSessionCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type UserMemoryCreateWithoutUserInput = {
    content: string
    category?: string | null
    createdAt?: Date | string
  }

  export type UserMemoryUncheckedCreateWithoutUserInput = {
    id?: number
    content: string
    category?: string | null
    createdAt?: Date | string
  }

  export type UserMemoryCreateOrConnectWithoutUserInput = {
    where: UserMemoryWhereUniqueInput
    create: XOR<UserMemoryCreateWithoutUserInput, UserMemoryUncheckedCreateWithoutUserInput>
  }

  export type UserMemoryCreateManyUserInputEnvelope = {
    data: UserMemoryCreateManyUserInput | UserMemoryCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type UserPersonaXpCreateWithoutUserInput = {
    xp?: number
    persona: PersonaCreateNestedOneWithoutPersonaXpsInput
  }

  export type UserPersonaXpUncheckedCreateWithoutUserInput = {
    personaId: string
    xp?: number
  }

  export type UserPersonaXpCreateOrConnectWithoutUserInput = {
    where: UserPersonaXpWhereUniqueInput
    create: XOR<UserPersonaXpCreateWithoutUserInput, UserPersonaXpUncheckedCreateWithoutUserInput>
  }

  export type UserPersonaXpCreateManyUserInputEnvelope = {
    data: UserPersonaXpCreateManyUserInput | UserPersonaXpCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type PersonaUpsertWithWhereUniqueWithoutUserInput = {
    where: PersonaWhereUniqueInput
    update: XOR<PersonaUpdateWithoutUserInput, PersonaUncheckedUpdateWithoutUserInput>
    create: XOR<PersonaCreateWithoutUserInput, PersonaUncheckedCreateWithoutUserInput>
  }

  export type PersonaUpdateWithWhereUniqueWithoutUserInput = {
    where: PersonaWhereUniqueInput
    data: XOR<PersonaUpdateWithoutUserInput, PersonaUncheckedUpdateWithoutUserInput>
  }

  export type PersonaUpdateManyWithWhereWithoutUserInput = {
    where: PersonaScalarWhereInput
    data: XOR<PersonaUpdateManyMutationInput, PersonaUncheckedUpdateManyWithoutUserInput>
  }

  export type PersonaScalarWhereInput = {
    AND?: PersonaScalarWhereInput | PersonaScalarWhereInput[]
    OR?: PersonaScalarWhereInput[]
    NOT?: PersonaScalarWhereInput | PersonaScalarWhereInput[]
    id?: StringFilter<"Persona"> | string
    name?: StringFilter<"Persona"> | string
    jobTitle?: StringNullableFilter<"Persona"> | string | null
    description?: StringNullableFilter<"Persona"> | string | null
    systemInstruction?: StringFilter<"Persona"> | string
    identityPrompt?: StringNullableFilter<"Persona"> | string | null
    iconName?: StringFilter<"Persona"> | string
    colorClass?: StringFilter<"Persona"> | string
    order?: IntFilter<"Persona"> | number
    imageUrl?: StringNullableFilter<"Persona"> | string | null
    isDefault?: BoolFilter<"Persona"> | boolean
    isVisible?: BoolFilter<"Persona"> | boolean
    createdBy?: IntNullableFilter<"Persona"> | number | null
    createdAt?: DateTimeFilter<"Persona"> | Date | string
  }

  export type ChatSessionUpsertWithWhereUniqueWithoutUserInput = {
    where: ChatSessionWhereUniqueInput
    update: XOR<ChatSessionUpdateWithoutUserInput, ChatSessionUncheckedUpdateWithoutUserInput>
    create: XOR<ChatSessionCreateWithoutUserInput, ChatSessionUncheckedCreateWithoutUserInput>
  }

  export type ChatSessionUpdateWithWhereUniqueWithoutUserInput = {
    where: ChatSessionWhereUniqueInput
    data: XOR<ChatSessionUpdateWithoutUserInput, ChatSessionUncheckedUpdateWithoutUserInput>
  }

  export type ChatSessionUpdateManyWithWhereWithoutUserInput = {
    where: ChatSessionScalarWhereInput
    data: XOR<ChatSessionUpdateManyMutationInput, ChatSessionUncheckedUpdateManyWithoutUserInput>
  }

  export type ChatSessionScalarWhereInput = {
    AND?: ChatSessionScalarWhereInput | ChatSessionScalarWhereInput[]
    OR?: ChatSessionScalarWhereInput[]
    NOT?: ChatSessionScalarWhereInput | ChatSessionScalarWhereInput[]
    id?: IntFilter<"ChatSession"> | number
    userId?: IntFilter<"ChatSession"> | number
    personaId?: StringFilter<"ChatSession"> | string
    title?: StringNullableFilter<"ChatSession"> | string | null
    createdAt?: DateTimeFilter<"ChatSession"> | Date | string
    updatedAt?: DateTimeFilter<"ChatSession"> | Date | string
  }

  export type UserMemoryUpsertWithWhereUniqueWithoutUserInput = {
    where: UserMemoryWhereUniqueInput
    update: XOR<UserMemoryUpdateWithoutUserInput, UserMemoryUncheckedUpdateWithoutUserInput>
    create: XOR<UserMemoryCreateWithoutUserInput, UserMemoryUncheckedCreateWithoutUserInput>
  }

  export type UserMemoryUpdateWithWhereUniqueWithoutUserInput = {
    where: UserMemoryWhereUniqueInput
    data: XOR<UserMemoryUpdateWithoutUserInput, UserMemoryUncheckedUpdateWithoutUserInput>
  }

  export type UserMemoryUpdateManyWithWhereWithoutUserInput = {
    where: UserMemoryScalarWhereInput
    data: XOR<UserMemoryUpdateManyMutationInput, UserMemoryUncheckedUpdateManyWithoutUserInput>
  }

  export type UserMemoryScalarWhereInput = {
    AND?: UserMemoryScalarWhereInput | UserMemoryScalarWhereInput[]
    OR?: UserMemoryScalarWhereInput[]
    NOT?: UserMemoryScalarWhereInput | UserMemoryScalarWhereInput[]
    id?: IntFilter<"UserMemory"> | number
    userId?: IntFilter<"UserMemory"> | number
    content?: StringFilter<"UserMemory"> | string
    category?: StringNullableFilter<"UserMemory"> | string | null
    createdAt?: DateTimeFilter<"UserMemory"> | Date | string
  }

  export type UserPersonaXpUpsertWithWhereUniqueWithoutUserInput = {
    where: UserPersonaXpWhereUniqueInput
    update: XOR<UserPersonaXpUpdateWithoutUserInput, UserPersonaXpUncheckedUpdateWithoutUserInput>
    create: XOR<UserPersonaXpCreateWithoutUserInput, UserPersonaXpUncheckedCreateWithoutUserInput>
  }

  export type UserPersonaXpUpdateWithWhereUniqueWithoutUserInput = {
    where: UserPersonaXpWhereUniqueInput
    data: XOR<UserPersonaXpUpdateWithoutUserInput, UserPersonaXpUncheckedUpdateWithoutUserInput>
  }

  export type UserPersonaXpUpdateManyWithWhereWithoutUserInput = {
    where: UserPersonaXpScalarWhereInput
    data: XOR<UserPersonaXpUpdateManyMutationInput, UserPersonaXpUncheckedUpdateManyWithoutUserInput>
  }

  export type UserPersonaXpScalarWhereInput = {
    AND?: UserPersonaXpScalarWhereInput | UserPersonaXpScalarWhereInput[]
    OR?: UserPersonaXpScalarWhereInput[]
    NOT?: UserPersonaXpScalarWhereInput | UserPersonaXpScalarWhereInput[]
    userId?: IntFilter<"UserPersonaXp"> | number
    personaId?: StringFilter<"UserPersonaXp"> | string
    xp?: IntFilter<"UserPersonaXp"> | number
  }

  export type UserCreateWithoutPersonaXpsInput = {
    email: string
    password: string
    username?: string | null
    role?: string
    resetToken?: string | null
    resetTokenExpiry?: Date | string | null
    createdAt?: Date | string
    personas?: PersonaCreateNestedManyWithoutUserInput
    sessions?: ChatSessionCreateNestedManyWithoutUserInput
    memories?: UserMemoryCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutPersonaXpsInput = {
    id?: number
    email: string
    password: string
    username?: string | null
    role?: string
    resetToken?: string | null
    resetTokenExpiry?: Date | string | null
    createdAt?: Date | string
    personas?: PersonaUncheckedCreateNestedManyWithoutUserInput
    sessions?: ChatSessionUncheckedCreateNestedManyWithoutUserInput
    memories?: UserMemoryUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutPersonaXpsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutPersonaXpsInput, UserUncheckedCreateWithoutPersonaXpsInput>
  }

  export type PersonaCreateWithoutPersonaXpsInput = {
    id?: string
    name: string
    jobTitle?: string | null
    description?: string | null
    systemInstruction: string
    identityPrompt?: string | null
    iconName?: string
    colorClass?: string
    order?: number
    imageUrl?: string | null
    isDefault?: boolean
    isVisible?: boolean
    createdAt?: Date | string
    user?: UserCreateNestedOneWithoutPersonasInput
    sessions?: ChatSessionCreateNestedManyWithoutPersonaInput
    images?: PersonaImageCreateNestedManyWithoutPersonaInput
  }

  export type PersonaUncheckedCreateWithoutPersonaXpsInput = {
    id?: string
    name: string
    jobTitle?: string | null
    description?: string | null
    systemInstruction: string
    identityPrompt?: string | null
    iconName?: string
    colorClass?: string
    order?: number
    imageUrl?: string | null
    isDefault?: boolean
    isVisible?: boolean
    createdBy?: number | null
    createdAt?: Date | string
    sessions?: ChatSessionUncheckedCreateNestedManyWithoutPersonaInput
    images?: PersonaImageUncheckedCreateNestedManyWithoutPersonaInput
  }

  export type PersonaCreateOrConnectWithoutPersonaXpsInput = {
    where: PersonaWhereUniqueInput
    create: XOR<PersonaCreateWithoutPersonaXpsInput, PersonaUncheckedCreateWithoutPersonaXpsInput>
  }

  export type UserUpsertWithoutPersonaXpsInput = {
    update: XOR<UserUpdateWithoutPersonaXpsInput, UserUncheckedUpdateWithoutPersonaXpsInput>
    create: XOR<UserCreateWithoutPersonaXpsInput, UserUncheckedCreateWithoutPersonaXpsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutPersonaXpsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutPersonaXpsInput, UserUncheckedUpdateWithoutPersonaXpsInput>
  }

  export type UserUpdateWithoutPersonaXpsInput = {
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    personas?: PersonaUpdateManyWithoutUserNestedInput
    sessions?: ChatSessionUpdateManyWithoutUserNestedInput
    memories?: UserMemoryUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutPersonaXpsInput = {
    id?: IntFieldUpdateOperationsInput | number
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    personas?: PersonaUncheckedUpdateManyWithoutUserNestedInput
    sessions?: ChatSessionUncheckedUpdateManyWithoutUserNestedInput
    memories?: UserMemoryUncheckedUpdateManyWithoutUserNestedInput
  }

  export type PersonaUpsertWithoutPersonaXpsInput = {
    update: XOR<PersonaUpdateWithoutPersonaXpsInput, PersonaUncheckedUpdateWithoutPersonaXpsInput>
    create: XOR<PersonaCreateWithoutPersonaXpsInput, PersonaUncheckedCreateWithoutPersonaXpsInput>
    where?: PersonaWhereInput
  }

  export type PersonaUpdateToOneWithWhereWithoutPersonaXpsInput = {
    where?: PersonaWhereInput
    data: XOR<PersonaUpdateWithoutPersonaXpsInput, PersonaUncheckedUpdateWithoutPersonaXpsInput>
  }

  export type PersonaUpdateWithoutPersonaXpsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    jobTitle?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    systemInstruction?: StringFieldUpdateOperationsInput | string
    identityPrompt?: NullableStringFieldUpdateOperationsInput | string | null
    iconName?: StringFieldUpdateOperationsInput | string
    colorClass?: StringFieldUpdateOperationsInput | string
    order?: IntFieldUpdateOperationsInput | number
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    isVisible?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneWithoutPersonasNestedInput
    sessions?: ChatSessionUpdateManyWithoutPersonaNestedInput
    images?: PersonaImageUpdateManyWithoutPersonaNestedInput
  }

  export type PersonaUncheckedUpdateWithoutPersonaXpsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    jobTitle?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    systemInstruction?: StringFieldUpdateOperationsInput | string
    identityPrompt?: NullableStringFieldUpdateOperationsInput | string | null
    iconName?: StringFieldUpdateOperationsInput | string
    colorClass?: StringFieldUpdateOperationsInput | string
    order?: IntFieldUpdateOperationsInput | number
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    isVisible?: BoolFieldUpdateOperationsInput | boolean
    createdBy?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: ChatSessionUncheckedUpdateManyWithoutPersonaNestedInput
    images?: PersonaImageUncheckedUpdateManyWithoutPersonaNestedInput
  }

  export type UserCreateWithoutMemoriesInput = {
    email: string
    password: string
    username?: string | null
    role?: string
    resetToken?: string | null
    resetTokenExpiry?: Date | string | null
    createdAt?: Date | string
    personas?: PersonaCreateNestedManyWithoutUserInput
    sessions?: ChatSessionCreateNestedManyWithoutUserInput
    personaXps?: UserPersonaXpCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutMemoriesInput = {
    id?: number
    email: string
    password: string
    username?: string | null
    role?: string
    resetToken?: string | null
    resetTokenExpiry?: Date | string | null
    createdAt?: Date | string
    personas?: PersonaUncheckedCreateNestedManyWithoutUserInput
    sessions?: ChatSessionUncheckedCreateNestedManyWithoutUserInput
    personaXps?: UserPersonaXpUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutMemoriesInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutMemoriesInput, UserUncheckedCreateWithoutMemoriesInput>
  }

  export type UserUpsertWithoutMemoriesInput = {
    update: XOR<UserUpdateWithoutMemoriesInput, UserUncheckedUpdateWithoutMemoriesInput>
    create: XOR<UserCreateWithoutMemoriesInput, UserUncheckedCreateWithoutMemoriesInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutMemoriesInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutMemoriesInput, UserUncheckedUpdateWithoutMemoriesInput>
  }

  export type UserUpdateWithoutMemoriesInput = {
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    personas?: PersonaUpdateManyWithoutUserNestedInput
    sessions?: ChatSessionUpdateManyWithoutUserNestedInput
    personaXps?: UserPersonaXpUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutMemoriesInput = {
    id?: IntFieldUpdateOperationsInput | number
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    personas?: PersonaUncheckedUpdateManyWithoutUserNestedInput
    sessions?: ChatSessionUncheckedUpdateManyWithoutUserNestedInput
    personaXps?: UserPersonaXpUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateWithoutPersonasInput = {
    email: string
    password: string
    username?: string | null
    role?: string
    resetToken?: string | null
    resetTokenExpiry?: Date | string | null
    createdAt?: Date | string
    sessions?: ChatSessionCreateNestedManyWithoutUserInput
    memories?: UserMemoryCreateNestedManyWithoutUserInput
    personaXps?: UserPersonaXpCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutPersonasInput = {
    id?: number
    email: string
    password: string
    username?: string | null
    role?: string
    resetToken?: string | null
    resetTokenExpiry?: Date | string | null
    createdAt?: Date | string
    sessions?: ChatSessionUncheckedCreateNestedManyWithoutUserInput
    memories?: UserMemoryUncheckedCreateNestedManyWithoutUserInput
    personaXps?: UserPersonaXpUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutPersonasInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutPersonasInput, UserUncheckedCreateWithoutPersonasInput>
  }

  export type ChatSessionCreateWithoutPersonaInput = {
    title?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutSessionsInput
    messages?: MessageCreateNestedManyWithoutSessionInput
    summary?: ConversationSummaryCreateNestedOneWithoutSessionInput
  }

  export type ChatSessionUncheckedCreateWithoutPersonaInput = {
    id?: number
    userId: number
    title?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    messages?: MessageUncheckedCreateNestedManyWithoutSessionInput
    summary?: ConversationSummaryUncheckedCreateNestedOneWithoutSessionInput
  }

  export type ChatSessionCreateOrConnectWithoutPersonaInput = {
    where: ChatSessionWhereUniqueInput
    create: XOR<ChatSessionCreateWithoutPersonaInput, ChatSessionUncheckedCreateWithoutPersonaInput>
  }

  export type ChatSessionCreateManyPersonaInputEnvelope = {
    data: ChatSessionCreateManyPersonaInput | ChatSessionCreateManyPersonaInput[]
    skipDuplicates?: boolean
  }

  export type PersonaImageCreateWithoutPersonaInput = {
    imageUrl: string
    description?: string | null
    isMain?: boolean
    order?: number
    requiredLevel?: number
    createdAt?: Date | string
    videos?: PersonaVideoCreateNestedManyWithoutImageInput
  }

  export type PersonaImageUncheckedCreateWithoutPersonaInput = {
    id?: number
    imageUrl: string
    description?: string | null
    isMain?: boolean
    order?: number
    requiredLevel?: number
    createdAt?: Date | string
    videos?: PersonaVideoUncheckedCreateNestedManyWithoutImageInput
  }

  export type PersonaImageCreateOrConnectWithoutPersonaInput = {
    where: PersonaImageWhereUniqueInput
    create: XOR<PersonaImageCreateWithoutPersonaInput, PersonaImageUncheckedCreateWithoutPersonaInput>
  }

  export type PersonaImageCreateManyPersonaInputEnvelope = {
    data: PersonaImageCreateManyPersonaInput | PersonaImageCreateManyPersonaInput[]
    skipDuplicates?: boolean
  }

  export type UserPersonaXpCreateWithoutPersonaInput = {
    xp?: number
    user: UserCreateNestedOneWithoutPersonaXpsInput
  }

  export type UserPersonaXpUncheckedCreateWithoutPersonaInput = {
    userId: number
    xp?: number
  }

  export type UserPersonaXpCreateOrConnectWithoutPersonaInput = {
    where: UserPersonaXpWhereUniqueInput
    create: XOR<UserPersonaXpCreateWithoutPersonaInput, UserPersonaXpUncheckedCreateWithoutPersonaInput>
  }

  export type UserPersonaXpCreateManyPersonaInputEnvelope = {
    data: UserPersonaXpCreateManyPersonaInput | UserPersonaXpCreateManyPersonaInput[]
    skipDuplicates?: boolean
  }

  export type UserUpsertWithoutPersonasInput = {
    update: XOR<UserUpdateWithoutPersonasInput, UserUncheckedUpdateWithoutPersonasInput>
    create: XOR<UserCreateWithoutPersonasInput, UserUncheckedCreateWithoutPersonasInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutPersonasInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutPersonasInput, UserUncheckedUpdateWithoutPersonasInput>
  }

  export type UserUpdateWithoutPersonasInput = {
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: ChatSessionUpdateManyWithoutUserNestedInput
    memories?: UserMemoryUpdateManyWithoutUserNestedInput
    personaXps?: UserPersonaXpUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutPersonasInput = {
    id?: IntFieldUpdateOperationsInput | number
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: ChatSessionUncheckedUpdateManyWithoutUserNestedInput
    memories?: UserMemoryUncheckedUpdateManyWithoutUserNestedInput
    personaXps?: UserPersonaXpUncheckedUpdateManyWithoutUserNestedInput
  }

  export type ChatSessionUpsertWithWhereUniqueWithoutPersonaInput = {
    where: ChatSessionWhereUniqueInput
    update: XOR<ChatSessionUpdateWithoutPersonaInput, ChatSessionUncheckedUpdateWithoutPersonaInput>
    create: XOR<ChatSessionCreateWithoutPersonaInput, ChatSessionUncheckedCreateWithoutPersonaInput>
  }

  export type ChatSessionUpdateWithWhereUniqueWithoutPersonaInput = {
    where: ChatSessionWhereUniqueInput
    data: XOR<ChatSessionUpdateWithoutPersonaInput, ChatSessionUncheckedUpdateWithoutPersonaInput>
  }

  export type ChatSessionUpdateManyWithWhereWithoutPersonaInput = {
    where: ChatSessionScalarWhereInput
    data: XOR<ChatSessionUpdateManyMutationInput, ChatSessionUncheckedUpdateManyWithoutPersonaInput>
  }

  export type PersonaImageUpsertWithWhereUniqueWithoutPersonaInput = {
    where: PersonaImageWhereUniqueInput
    update: XOR<PersonaImageUpdateWithoutPersonaInput, PersonaImageUncheckedUpdateWithoutPersonaInput>
    create: XOR<PersonaImageCreateWithoutPersonaInput, PersonaImageUncheckedCreateWithoutPersonaInput>
  }

  export type PersonaImageUpdateWithWhereUniqueWithoutPersonaInput = {
    where: PersonaImageWhereUniqueInput
    data: XOR<PersonaImageUpdateWithoutPersonaInput, PersonaImageUncheckedUpdateWithoutPersonaInput>
  }

  export type PersonaImageUpdateManyWithWhereWithoutPersonaInput = {
    where: PersonaImageScalarWhereInput
    data: XOR<PersonaImageUpdateManyMutationInput, PersonaImageUncheckedUpdateManyWithoutPersonaInput>
  }

  export type PersonaImageScalarWhereInput = {
    AND?: PersonaImageScalarWhereInput | PersonaImageScalarWhereInput[]
    OR?: PersonaImageScalarWhereInput[]
    NOT?: PersonaImageScalarWhereInput | PersonaImageScalarWhereInput[]
    id?: IntFilter<"PersonaImage"> | number
    personaId?: StringFilter<"PersonaImage"> | string
    imageUrl?: StringFilter<"PersonaImage"> | string
    description?: StringNullableFilter<"PersonaImage"> | string | null
    isMain?: BoolFilter<"PersonaImage"> | boolean
    order?: IntFilter<"PersonaImage"> | number
    requiredLevel?: IntFilter<"PersonaImage"> | number
    createdAt?: DateTimeFilter<"PersonaImage"> | Date | string
  }

  export type UserPersonaXpUpsertWithWhereUniqueWithoutPersonaInput = {
    where: UserPersonaXpWhereUniqueInput
    update: XOR<UserPersonaXpUpdateWithoutPersonaInput, UserPersonaXpUncheckedUpdateWithoutPersonaInput>
    create: XOR<UserPersonaXpCreateWithoutPersonaInput, UserPersonaXpUncheckedCreateWithoutPersonaInput>
  }

  export type UserPersonaXpUpdateWithWhereUniqueWithoutPersonaInput = {
    where: UserPersonaXpWhereUniqueInput
    data: XOR<UserPersonaXpUpdateWithoutPersonaInput, UserPersonaXpUncheckedUpdateWithoutPersonaInput>
  }

  export type UserPersonaXpUpdateManyWithWhereWithoutPersonaInput = {
    where: UserPersonaXpScalarWhereInput
    data: XOR<UserPersonaXpUpdateManyMutationInput, UserPersonaXpUncheckedUpdateManyWithoutPersonaInput>
  }

  export type PersonaCreateWithoutImagesInput = {
    id?: string
    name: string
    jobTitle?: string | null
    description?: string | null
    systemInstruction: string
    identityPrompt?: string | null
    iconName?: string
    colorClass?: string
    order?: number
    imageUrl?: string | null
    isDefault?: boolean
    isVisible?: boolean
    createdAt?: Date | string
    user?: UserCreateNestedOneWithoutPersonasInput
    sessions?: ChatSessionCreateNestedManyWithoutPersonaInput
    personaXps?: UserPersonaXpCreateNestedManyWithoutPersonaInput
  }

  export type PersonaUncheckedCreateWithoutImagesInput = {
    id?: string
    name: string
    jobTitle?: string | null
    description?: string | null
    systemInstruction: string
    identityPrompt?: string | null
    iconName?: string
    colorClass?: string
    order?: number
    imageUrl?: string | null
    isDefault?: boolean
    isVisible?: boolean
    createdBy?: number | null
    createdAt?: Date | string
    sessions?: ChatSessionUncheckedCreateNestedManyWithoutPersonaInput
    personaXps?: UserPersonaXpUncheckedCreateNestedManyWithoutPersonaInput
  }

  export type PersonaCreateOrConnectWithoutImagesInput = {
    where: PersonaWhereUniqueInput
    create: XOR<PersonaCreateWithoutImagesInput, PersonaUncheckedCreateWithoutImagesInput>
  }

  export type PersonaVideoCreateWithoutImageInput = {
    videoUrl: string
    title?: string | null
    order?: number
    requiredLevel?: number
    createdAt?: Date | string
  }

  export type PersonaVideoUncheckedCreateWithoutImageInput = {
    id?: number
    videoUrl: string
    title?: string | null
    order?: number
    requiredLevel?: number
    createdAt?: Date | string
  }

  export type PersonaVideoCreateOrConnectWithoutImageInput = {
    where: PersonaVideoWhereUniqueInput
    create: XOR<PersonaVideoCreateWithoutImageInput, PersonaVideoUncheckedCreateWithoutImageInput>
  }

  export type PersonaVideoCreateManyImageInputEnvelope = {
    data: PersonaVideoCreateManyImageInput | PersonaVideoCreateManyImageInput[]
    skipDuplicates?: boolean
  }

  export type PersonaUpsertWithoutImagesInput = {
    update: XOR<PersonaUpdateWithoutImagesInput, PersonaUncheckedUpdateWithoutImagesInput>
    create: XOR<PersonaCreateWithoutImagesInput, PersonaUncheckedCreateWithoutImagesInput>
    where?: PersonaWhereInput
  }

  export type PersonaUpdateToOneWithWhereWithoutImagesInput = {
    where?: PersonaWhereInput
    data: XOR<PersonaUpdateWithoutImagesInput, PersonaUncheckedUpdateWithoutImagesInput>
  }

  export type PersonaUpdateWithoutImagesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    jobTitle?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    systemInstruction?: StringFieldUpdateOperationsInput | string
    identityPrompt?: NullableStringFieldUpdateOperationsInput | string | null
    iconName?: StringFieldUpdateOperationsInput | string
    colorClass?: StringFieldUpdateOperationsInput | string
    order?: IntFieldUpdateOperationsInput | number
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    isVisible?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneWithoutPersonasNestedInput
    sessions?: ChatSessionUpdateManyWithoutPersonaNestedInput
    personaXps?: UserPersonaXpUpdateManyWithoutPersonaNestedInput
  }

  export type PersonaUncheckedUpdateWithoutImagesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    jobTitle?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    systemInstruction?: StringFieldUpdateOperationsInput | string
    identityPrompt?: NullableStringFieldUpdateOperationsInput | string | null
    iconName?: StringFieldUpdateOperationsInput | string
    colorClass?: StringFieldUpdateOperationsInput | string
    order?: IntFieldUpdateOperationsInput | number
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    isVisible?: BoolFieldUpdateOperationsInput | boolean
    createdBy?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: ChatSessionUncheckedUpdateManyWithoutPersonaNestedInput
    personaXps?: UserPersonaXpUncheckedUpdateManyWithoutPersonaNestedInput
  }

  export type PersonaVideoUpsertWithWhereUniqueWithoutImageInput = {
    where: PersonaVideoWhereUniqueInput
    update: XOR<PersonaVideoUpdateWithoutImageInput, PersonaVideoUncheckedUpdateWithoutImageInput>
    create: XOR<PersonaVideoCreateWithoutImageInput, PersonaVideoUncheckedCreateWithoutImageInput>
  }

  export type PersonaVideoUpdateWithWhereUniqueWithoutImageInput = {
    where: PersonaVideoWhereUniqueInput
    data: XOR<PersonaVideoUpdateWithoutImageInput, PersonaVideoUncheckedUpdateWithoutImageInput>
  }

  export type PersonaVideoUpdateManyWithWhereWithoutImageInput = {
    where: PersonaVideoScalarWhereInput
    data: XOR<PersonaVideoUpdateManyMutationInput, PersonaVideoUncheckedUpdateManyWithoutImageInput>
  }

  export type PersonaVideoScalarWhereInput = {
    AND?: PersonaVideoScalarWhereInput | PersonaVideoScalarWhereInput[]
    OR?: PersonaVideoScalarWhereInput[]
    NOT?: PersonaVideoScalarWhereInput | PersonaVideoScalarWhereInput[]
    id?: IntFilter<"PersonaVideo"> | number
    imageId?: IntFilter<"PersonaVideo"> | number
    videoUrl?: StringFilter<"PersonaVideo"> | string
    title?: StringNullableFilter<"PersonaVideo"> | string | null
    order?: IntFilter<"PersonaVideo"> | number
    requiredLevel?: IntFilter<"PersonaVideo"> | number
    createdAt?: DateTimeFilter<"PersonaVideo"> | Date | string
  }

  export type PersonaImageCreateWithoutVideosInput = {
    imageUrl: string
    description?: string | null
    isMain?: boolean
    order?: number
    requiredLevel?: number
    createdAt?: Date | string
    persona: PersonaCreateNestedOneWithoutImagesInput
  }

  export type PersonaImageUncheckedCreateWithoutVideosInput = {
    id?: number
    personaId: string
    imageUrl: string
    description?: string | null
    isMain?: boolean
    order?: number
    requiredLevel?: number
    createdAt?: Date | string
  }

  export type PersonaImageCreateOrConnectWithoutVideosInput = {
    where: PersonaImageWhereUniqueInput
    create: XOR<PersonaImageCreateWithoutVideosInput, PersonaImageUncheckedCreateWithoutVideosInput>
  }

  export type PersonaImageUpsertWithoutVideosInput = {
    update: XOR<PersonaImageUpdateWithoutVideosInput, PersonaImageUncheckedUpdateWithoutVideosInput>
    create: XOR<PersonaImageCreateWithoutVideosInput, PersonaImageUncheckedCreateWithoutVideosInput>
    where?: PersonaImageWhereInput
  }

  export type PersonaImageUpdateToOneWithWhereWithoutVideosInput = {
    where?: PersonaImageWhereInput
    data: XOR<PersonaImageUpdateWithoutVideosInput, PersonaImageUncheckedUpdateWithoutVideosInput>
  }

  export type PersonaImageUpdateWithoutVideosInput = {
    imageUrl?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    isMain?: BoolFieldUpdateOperationsInput | boolean
    order?: IntFieldUpdateOperationsInput | number
    requiredLevel?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    persona?: PersonaUpdateOneRequiredWithoutImagesNestedInput
  }

  export type PersonaImageUncheckedUpdateWithoutVideosInput = {
    id?: IntFieldUpdateOperationsInput | number
    personaId?: StringFieldUpdateOperationsInput | string
    imageUrl?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    isMain?: BoolFieldUpdateOperationsInput | boolean
    order?: IntFieldUpdateOperationsInput | number
    requiredLevel?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserCreateWithoutSessionsInput = {
    email: string
    password: string
    username?: string | null
    role?: string
    resetToken?: string | null
    resetTokenExpiry?: Date | string | null
    createdAt?: Date | string
    personas?: PersonaCreateNestedManyWithoutUserInput
    memories?: UserMemoryCreateNestedManyWithoutUserInput
    personaXps?: UserPersonaXpCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutSessionsInput = {
    id?: number
    email: string
    password: string
    username?: string | null
    role?: string
    resetToken?: string | null
    resetTokenExpiry?: Date | string | null
    createdAt?: Date | string
    personas?: PersonaUncheckedCreateNestedManyWithoutUserInput
    memories?: UserMemoryUncheckedCreateNestedManyWithoutUserInput
    personaXps?: UserPersonaXpUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutSessionsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutSessionsInput, UserUncheckedCreateWithoutSessionsInput>
  }

  export type PersonaCreateWithoutSessionsInput = {
    id?: string
    name: string
    jobTitle?: string | null
    description?: string | null
    systemInstruction: string
    identityPrompt?: string | null
    iconName?: string
    colorClass?: string
    order?: number
    imageUrl?: string | null
    isDefault?: boolean
    isVisible?: boolean
    createdAt?: Date | string
    user?: UserCreateNestedOneWithoutPersonasInput
    images?: PersonaImageCreateNestedManyWithoutPersonaInput
    personaXps?: UserPersonaXpCreateNestedManyWithoutPersonaInput
  }

  export type PersonaUncheckedCreateWithoutSessionsInput = {
    id?: string
    name: string
    jobTitle?: string | null
    description?: string | null
    systemInstruction: string
    identityPrompt?: string | null
    iconName?: string
    colorClass?: string
    order?: number
    imageUrl?: string | null
    isDefault?: boolean
    isVisible?: boolean
    createdBy?: number | null
    createdAt?: Date | string
    images?: PersonaImageUncheckedCreateNestedManyWithoutPersonaInput
    personaXps?: UserPersonaXpUncheckedCreateNestedManyWithoutPersonaInput
  }

  export type PersonaCreateOrConnectWithoutSessionsInput = {
    where: PersonaWhereUniqueInput
    create: XOR<PersonaCreateWithoutSessionsInput, PersonaUncheckedCreateWithoutSessionsInput>
  }

  export type MessageCreateWithoutSessionInput = {
    role: string
    text: string
    createdAt?: Date | string
  }

  export type MessageUncheckedCreateWithoutSessionInput = {
    id?: number
    role: string
    text: string
    createdAt?: Date | string
  }

  export type MessageCreateOrConnectWithoutSessionInput = {
    where: MessageWhereUniqueInput
    create: XOR<MessageCreateWithoutSessionInput, MessageUncheckedCreateWithoutSessionInput>
  }

  export type MessageCreateManySessionInputEnvelope = {
    data: MessageCreateManySessionInput | MessageCreateManySessionInput[]
    skipDuplicates?: boolean
  }

  export type ConversationSummaryCreateWithoutSessionInput = {
    summary: string
    messageCount: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ConversationSummaryUncheckedCreateWithoutSessionInput = {
    id?: number
    summary: string
    messageCount: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ConversationSummaryCreateOrConnectWithoutSessionInput = {
    where: ConversationSummaryWhereUniqueInput
    create: XOR<ConversationSummaryCreateWithoutSessionInput, ConversationSummaryUncheckedCreateWithoutSessionInput>
  }

  export type UserUpsertWithoutSessionsInput = {
    update: XOR<UserUpdateWithoutSessionsInput, UserUncheckedUpdateWithoutSessionsInput>
    create: XOR<UserCreateWithoutSessionsInput, UserUncheckedCreateWithoutSessionsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutSessionsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutSessionsInput, UserUncheckedUpdateWithoutSessionsInput>
  }

  export type UserUpdateWithoutSessionsInput = {
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    personas?: PersonaUpdateManyWithoutUserNestedInput
    memories?: UserMemoryUpdateManyWithoutUserNestedInput
    personaXps?: UserPersonaXpUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutSessionsInput = {
    id?: IntFieldUpdateOperationsInput | number
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    personas?: PersonaUncheckedUpdateManyWithoutUserNestedInput
    memories?: UserMemoryUncheckedUpdateManyWithoutUserNestedInput
    personaXps?: UserPersonaXpUncheckedUpdateManyWithoutUserNestedInput
  }

  export type PersonaUpsertWithoutSessionsInput = {
    update: XOR<PersonaUpdateWithoutSessionsInput, PersonaUncheckedUpdateWithoutSessionsInput>
    create: XOR<PersonaCreateWithoutSessionsInput, PersonaUncheckedCreateWithoutSessionsInput>
    where?: PersonaWhereInput
  }

  export type PersonaUpdateToOneWithWhereWithoutSessionsInput = {
    where?: PersonaWhereInput
    data: XOR<PersonaUpdateWithoutSessionsInput, PersonaUncheckedUpdateWithoutSessionsInput>
  }

  export type PersonaUpdateWithoutSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    jobTitle?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    systemInstruction?: StringFieldUpdateOperationsInput | string
    identityPrompt?: NullableStringFieldUpdateOperationsInput | string | null
    iconName?: StringFieldUpdateOperationsInput | string
    colorClass?: StringFieldUpdateOperationsInput | string
    order?: IntFieldUpdateOperationsInput | number
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    isVisible?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneWithoutPersonasNestedInput
    images?: PersonaImageUpdateManyWithoutPersonaNestedInput
    personaXps?: UserPersonaXpUpdateManyWithoutPersonaNestedInput
  }

  export type PersonaUncheckedUpdateWithoutSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    jobTitle?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    systemInstruction?: StringFieldUpdateOperationsInput | string
    identityPrompt?: NullableStringFieldUpdateOperationsInput | string | null
    iconName?: StringFieldUpdateOperationsInput | string
    colorClass?: StringFieldUpdateOperationsInput | string
    order?: IntFieldUpdateOperationsInput | number
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    isVisible?: BoolFieldUpdateOperationsInput | boolean
    createdBy?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    images?: PersonaImageUncheckedUpdateManyWithoutPersonaNestedInput
    personaXps?: UserPersonaXpUncheckedUpdateManyWithoutPersonaNestedInput
  }

  export type MessageUpsertWithWhereUniqueWithoutSessionInput = {
    where: MessageWhereUniqueInput
    update: XOR<MessageUpdateWithoutSessionInput, MessageUncheckedUpdateWithoutSessionInput>
    create: XOR<MessageCreateWithoutSessionInput, MessageUncheckedCreateWithoutSessionInput>
  }

  export type MessageUpdateWithWhereUniqueWithoutSessionInput = {
    where: MessageWhereUniqueInput
    data: XOR<MessageUpdateWithoutSessionInput, MessageUncheckedUpdateWithoutSessionInput>
  }

  export type MessageUpdateManyWithWhereWithoutSessionInput = {
    where: MessageScalarWhereInput
    data: XOR<MessageUpdateManyMutationInput, MessageUncheckedUpdateManyWithoutSessionInput>
  }

  export type MessageScalarWhereInput = {
    AND?: MessageScalarWhereInput | MessageScalarWhereInput[]
    OR?: MessageScalarWhereInput[]
    NOT?: MessageScalarWhereInput | MessageScalarWhereInput[]
    id?: IntFilter<"Message"> | number
    sessionId?: IntFilter<"Message"> | number
    role?: StringFilter<"Message"> | string
    text?: StringFilter<"Message"> | string
    createdAt?: DateTimeFilter<"Message"> | Date | string
  }

  export type ConversationSummaryUpsertWithoutSessionInput = {
    update: XOR<ConversationSummaryUpdateWithoutSessionInput, ConversationSummaryUncheckedUpdateWithoutSessionInput>
    create: XOR<ConversationSummaryCreateWithoutSessionInput, ConversationSummaryUncheckedCreateWithoutSessionInput>
    where?: ConversationSummaryWhereInput
  }

  export type ConversationSummaryUpdateToOneWithWhereWithoutSessionInput = {
    where?: ConversationSummaryWhereInput
    data: XOR<ConversationSummaryUpdateWithoutSessionInput, ConversationSummaryUncheckedUpdateWithoutSessionInput>
  }

  export type ConversationSummaryUpdateWithoutSessionInput = {
    summary?: StringFieldUpdateOperationsInput | string
    messageCount?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ConversationSummaryUncheckedUpdateWithoutSessionInput = {
    id?: IntFieldUpdateOperationsInput | number
    summary?: StringFieldUpdateOperationsInput | string
    messageCount?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ChatSessionCreateWithoutMessagesInput = {
    title?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutSessionsInput
    persona: PersonaCreateNestedOneWithoutSessionsInput
    summary?: ConversationSummaryCreateNestedOneWithoutSessionInput
  }

  export type ChatSessionUncheckedCreateWithoutMessagesInput = {
    id?: number
    userId: number
    personaId: string
    title?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    summary?: ConversationSummaryUncheckedCreateNestedOneWithoutSessionInput
  }

  export type ChatSessionCreateOrConnectWithoutMessagesInput = {
    where: ChatSessionWhereUniqueInput
    create: XOR<ChatSessionCreateWithoutMessagesInput, ChatSessionUncheckedCreateWithoutMessagesInput>
  }

  export type ChatSessionUpsertWithoutMessagesInput = {
    update: XOR<ChatSessionUpdateWithoutMessagesInput, ChatSessionUncheckedUpdateWithoutMessagesInput>
    create: XOR<ChatSessionCreateWithoutMessagesInput, ChatSessionUncheckedCreateWithoutMessagesInput>
    where?: ChatSessionWhereInput
  }

  export type ChatSessionUpdateToOneWithWhereWithoutMessagesInput = {
    where?: ChatSessionWhereInput
    data: XOR<ChatSessionUpdateWithoutMessagesInput, ChatSessionUncheckedUpdateWithoutMessagesInput>
  }

  export type ChatSessionUpdateWithoutMessagesInput = {
    title?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutSessionsNestedInput
    persona?: PersonaUpdateOneRequiredWithoutSessionsNestedInput
    summary?: ConversationSummaryUpdateOneWithoutSessionNestedInput
  }

  export type ChatSessionUncheckedUpdateWithoutMessagesInput = {
    id?: IntFieldUpdateOperationsInput | number
    userId?: IntFieldUpdateOperationsInput | number
    personaId?: StringFieldUpdateOperationsInput | string
    title?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    summary?: ConversationSummaryUncheckedUpdateOneWithoutSessionNestedInput
  }

  export type ChatSessionCreateWithoutSummaryInput = {
    title?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutSessionsInput
    persona: PersonaCreateNestedOneWithoutSessionsInput
    messages?: MessageCreateNestedManyWithoutSessionInput
  }

  export type ChatSessionUncheckedCreateWithoutSummaryInput = {
    id?: number
    userId: number
    personaId: string
    title?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    messages?: MessageUncheckedCreateNestedManyWithoutSessionInput
  }

  export type ChatSessionCreateOrConnectWithoutSummaryInput = {
    where: ChatSessionWhereUniqueInput
    create: XOR<ChatSessionCreateWithoutSummaryInput, ChatSessionUncheckedCreateWithoutSummaryInput>
  }

  export type ChatSessionUpsertWithoutSummaryInput = {
    update: XOR<ChatSessionUpdateWithoutSummaryInput, ChatSessionUncheckedUpdateWithoutSummaryInput>
    create: XOR<ChatSessionCreateWithoutSummaryInput, ChatSessionUncheckedCreateWithoutSummaryInput>
    where?: ChatSessionWhereInput
  }

  export type ChatSessionUpdateToOneWithWhereWithoutSummaryInput = {
    where?: ChatSessionWhereInput
    data: XOR<ChatSessionUpdateWithoutSummaryInput, ChatSessionUncheckedUpdateWithoutSummaryInput>
  }

  export type ChatSessionUpdateWithoutSummaryInput = {
    title?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutSessionsNestedInput
    persona?: PersonaUpdateOneRequiredWithoutSessionsNestedInput
    messages?: MessageUpdateManyWithoutSessionNestedInput
  }

  export type ChatSessionUncheckedUpdateWithoutSummaryInput = {
    id?: IntFieldUpdateOperationsInput | number
    userId?: IntFieldUpdateOperationsInput | number
    personaId?: StringFieldUpdateOperationsInput | string
    title?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    messages?: MessageUncheckedUpdateManyWithoutSessionNestedInput
  }

  export type PersonaCreateManyUserInput = {
    id?: string
    name: string
    jobTitle?: string | null
    description?: string | null
    systemInstruction: string
    identityPrompt?: string | null
    iconName?: string
    colorClass?: string
    order?: number
    imageUrl?: string | null
    isDefault?: boolean
    isVisible?: boolean
    createdAt?: Date | string
  }

  export type ChatSessionCreateManyUserInput = {
    id?: number
    personaId: string
    title?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserMemoryCreateManyUserInput = {
    id?: number
    content: string
    category?: string | null
    createdAt?: Date | string
  }

  export type UserPersonaXpCreateManyUserInput = {
    personaId: string
    xp?: number
  }

  export type PersonaUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    jobTitle?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    systemInstruction?: StringFieldUpdateOperationsInput | string
    identityPrompt?: NullableStringFieldUpdateOperationsInput | string | null
    iconName?: StringFieldUpdateOperationsInput | string
    colorClass?: StringFieldUpdateOperationsInput | string
    order?: IntFieldUpdateOperationsInput | number
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    isVisible?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: ChatSessionUpdateManyWithoutPersonaNestedInput
    images?: PersonaImageUpdateManyWithoutPersonaNestedInput
    personaXps?: UserPersonaXpUpdateManyWithoutPersonaNestedInput
  }

  export type PersonaUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    jobTitle?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    systemInstruction?: StringFieldUpdateOperationsInput | string
    identityPrompt?: NullableStringFieldUpdateOperationsInput | string | null
    iconName?: StringFieldUpdateOperationsInput | string
    colorClass?: StringFieldUpdateOperationsInput | string
    order?: IntFieldUpdateOperationsInput | number
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    isVisible?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: ChatSessionUncheckedUpdateManyWithoutPersonaNestedInput
    images?: PersonaImageUncheckedUpdateManyWithoutPersonaNestedInput
    personaXps?: UserPersonaXpUncheckedUpdateManyWithoutPersonaNestedInput
  }

  export type PersonaUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    jobTitle?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    systemInstruction?: StringFieldUpdateOperationsInput | string
    identityPrompt?: NullableStringFieldUpdateOperationsInput | string | null
    iconName?: StringFieldUpdateOperationsInput | string
    colorClass?: StringFieldUpdateOperationsInput | string
    order?: IntFieldUpdateOperationsInput | number
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    isVisible?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ChatSessionUpdateWithoutUserInput = {
    title?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    persona?: PersonaUpdateOneRequiredWithoutSessionsNestedInput
    messages?: MessageUpdateManyWithoutSessionNestedInput
    summary?: ConversationSummaryUpdateOneWithoutSessionNestedInput
  }

  export type ChatSessionUncheckedUpdateWithoutUserInput = {
    id?: IntFieldUpdateOperationsInput | number
    personaId?: StringFieldUpdateOperationsInput | string
    title?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    messages?: MessageUncheckedUpdateManyWithoutSessionNestedInput
    summary?: ConversationSummaryUncheckedUpdateOneWithoutSessionNestedInput
  }

  export type ChatSessionUncheckedUpdateManyWithoutUserInput = {
    id?: IntFieldUpdateOperationsInput | number
    personaId?: StringFieldUpdateOperationsInput | string
    title?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserMemoryUpdateWithoutUserInput = {
    content?: StringFieldUpdateOperationsInput | string
    category?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserMemoryUncheckedUpdateWithoutUserInput = {
    id?: IntFieldUpdateOperationsInput | number
    content?: StringFieldUpdateOperationsInput | string
    category?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserMemoryUncheckedUpdateManyWithoutUserInput = {
    id?: IntFieldUpdateOperationsInput | number
    content?: StringFieldUpdateOperationsInput | string
    category?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserPersonaXpUpdateWithoutUserInput = {
    xp?: IntFieldUpdateOperationsInput | number
    persona?: PersonaUpdateOneRequiredWithoutPersonaXpsNestedInput
  }

  export type UserPersonaXpUncheckedUpdateWithoutUserInput = {
    personaId?: StringFieldUpdateOperationsInput | string
    xp?: IntFieldUpdateOperationsInput | number
  }

  export type UserPersonaXpUncheckedUpdateManyWithoutUserInput = {
    personaId?: StringFieldUpdateOperationsInput | string
    xp?: IntFieldUpdateOperationsInput | number
  }

  export type ChatSessionCreateManyPersonaInput = {
    id?: number
    userId: number
    title?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PersonaImageCreateManyPersonaInput = {
    id?: number
    imageUrl: string
    description?: string | null
    isMain?: boolean
    order?: number
    requiredLevel?: number
    createdAt?: Date | string
  }

  export type UserPersonaXpCreateManyPersonaInput = {
    userId: number
    xp?: number
  }

  export type ChatSessionUpdateWithoutPersonaInput = {
    title?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutSessionsNestedInput
    messages?: MessageUpdateManyWithoutSessionNestedInput
    summary?: ConversationSummaryUpdateOneWithoutSessionNestedInput
  }

  export type ChatSessionUncheckedUpdateWithoutPersonaInput = {
    id?: IntFieldUpdateOperationsInput | number
    userId?: IntFieldUpdateOperationsInput | number
    title?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    messages?: MessageUncheckedUpdateManyWithoutSessionNestedInput
    summary?: ConversationSummaryUncheckedUpdateOneWithoutSessionNestedInput
  }

  export type ChatSessionUncheckedUpdateManyWithoutPersonaInput = {
    id?: IntFieldUpdateOperationsInput | number
    userId?: IntFieldUpdateOperationsInput | number
    title?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonaImageUpdateWithoutPersonaInput = {
    imageUrl?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    isMain?: BoolFieldUpdateOperationsInput | boolean
    order?: IntFieldUpdateOperationsInput | number
    requiredLevel?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    videos?: PersonaVideoUpdateManyWithoutImageNestedInput
  }

  export type PersonaImageUncheckedUpdateWithoutPersonaInput = {
    id?: IntFieldUpdateOperationsInput | number
    imageUrl?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    isMain?: BoolFieldUpdateOperationsInput | boolean
    order?: IntFieldUpdateOperationsInput | number
    requiredLevel?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    videos?: PersonaVideoUncheckedUpdateManyWithoutImageNestedInput
  }

  export type PersonaImageUncheckedUpdateManyWithoutPersonaInput = {
    id?: IntFieldUpdateOperationsInput | number
    imageUrl?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    isMain?: BoolFieldUpdateOperationsInput | boolean
    order?: IntFieldUpdateOperationsInput | number
    requiredLevel?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserPersonaXpUpdateWithoutPersonaInput = {
    xp?: IntFieldUpdateOperationsInput | number
    user?: UserUpdateOneRequiredWithoutPersonaXpsNestedInput
  }

  export type UserPersonaXpUncheckedUpdateWithoutPersonaInput = {
    userId?: IntFieldUpdateOperationsInput | number
    xp?: IntFieldUpdateOperationsInput | number
  }

  export type UserPersonaXpUncheckedUpdateManyWithoutPersonaInput = {
    userId?: IntFieldUpdateOperationsInput | number
    xp?: IntFieldUpdateOperationsInput | number
  }

  export type PersonaVideoCreateManyImageInput = {
    id?: number
    videoUrl: string
    title?: string | null
    order?: number
    requiredLevel?: number
    createdAt?: Date | string
  }

  export type PersonaVideoUpdateWithoutImageInput = {
    videoUrl?: StringFieldUpdateOperationsInput | string
    title?: NullableStringFieldUpdateOperationsInput | string | null
    order?: IntFieldUpdateOperationsInput | number
    requiredLevel?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonaVideoUncheckedUpdateWithoutImageInput = {
    id?: IntFieldUpdateOperationsInput | number
    videoUrl?: StringFieldUpdateOperationsInput | string
    title?: NullableStringFieldUpdateOperationsInput | string | null
    order?: IntFieldUpdateOperationsInput | number
    requiredLevel?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PersonaVideoUncheckedUpdateManyWithoutImageInput = {
    id?: IntFieldUpdateOperationsInput | number
    videoUrl?: StringFieldUpdateOperationsInput | string
    title?: NullableStringFieldUpdateOperationsInput | string | null
    order?: IntFieldUpdateOperationsInput | number
    requiredLevel?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MessageCreateManySessionInput = {
    id?: number
    role: string
    text: string
    createdAt?: Date | string
  }

  export type MessageUpdateWithoutSessionInput = {
    role?: StringFieldUpdateOperationsInput | string
    text?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MessageUncheckedUpdateWithoutSessionInput = {
    id?: IntFieldUpdateOperationsInput | number
    role?: StringFieldUpdateOperationsInput | string
    text?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MessageUncheckedUpdateManyWithoutSessionInput = {
    id?: IntFieldUpdateOperationsInput | number
    role?: StringFieldUpdateOperationsInput | string
    text?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}