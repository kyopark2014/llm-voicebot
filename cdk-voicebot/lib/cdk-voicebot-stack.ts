import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudFront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as apiGateway from 'aws-cdk-lib/aws-apigateway';
import * as s3Deploy from "aws-cdk-lib/aws-s3-deployment";
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Role, ManagedPolicy, ServicePrincipal } from "aws-cdk-lib/aws-iam";

const region = process.env.CDK_DEFAULT_REGION;    
const accountId = process.env.CDK_DEFAULT_ACCOUNT
const debug = false;
const stage = 'dev';
const s3_prefix = 'docs';
const projectName = `llm-voicebot`; 
const bucketName = `storage-for-${projectName}-${accountId}-${region}`; 

const claude3_sonnet = [
  {
    "bedrock_region": "us-west-2", // Oregon
    "model_type": "claude3",
    "model_id": "anthropic.claude-3-sonnet-20240229-v1:0",   
    "maxOutputTokens": "4096"
  },
  {
    "bedrock_region": "us-east-1", // N.Virginia
    "model_type": "claude3",
    "model_id": "anthropic.claude-3-sonnet-20240229-v1:0",
    "maxOutputTokens": "4096"
  },
  {
    "bedrock_region": "ap-southeast-2", // Sydney
    "model_type": "claude3",
    "model_id": "anthropic.claude-3-sonnet-20240229-v1:0",
    "maxOutputTokens": "4096"
  },
  {
    "bedrock_region": "eu-west-3", // Paris
    "model_type": "claude3",
    "model_id": "anthropic.claude-3-sonnet-20240229-v1:0",
    "maxOutputTokens": "4096"
  },
  {
    "bedrock_region": "ap-south-1", // Mumbai
    "model_type": "claude3",
    "model_id": "anthropic.claude-3-sonnet-20240229-v1:0",
    "maxOutputTokens": "4096"
  }
];

const claude3_haiku = [
  {
    "bedrock_region": "us-west-2", // Oregon
    "model_type": "claude3",
    "model_id": "anthropic.claude-3-haiku-20240307-v1:0",   
    "maxOutputTokens": "4096"
  },
  {
    "bedrock_region": "us-east-1", // N.Virginia
    "model_type": "claude3",
    "model_id": "anthropic.claude-3-haiku-20240307-v1:0",
    "maxOutputTokens": "4096"
  },
  {
    "bedrock_region": "ap-southeast-2", // Sydney
    "model_type": "claude3",
    "model_id": "anthropic.claude-3-haiku-20240307-v1:0",
    "maxOutputTokens": "4096"
  },
  {
    "bedrock_region": "eu-west-3", // Paris
    "model_type": "claude3",
    "model_id": "anthropic.claude-3-haiku-20240307-v1:0",
    "maxOutputTokens": "4096"
  },
  {
    "bedrock_region": "ap-south-1", // Mumbai
    "model_type": "claude3",
    "model_id": "anthropic.claude-3-haiku-20240307-v1:0",
    "maxOutputTokens": "4096"
  }
];

const claude_instant = [
  {
    "bedrock_region": "us-west-2", // Oregon
    "model_type": "claude",
    "model_id": "anthropic.claude-instant-v1",
    "maxOutputTokens": "4096"
  },
  {
    "bedrock_region": "us-east-1", // N.Virginia
    "model_type": "claude",
    "model_id": "anthropic.claude-instant-v1",
    "maxOutputTokens": "4096"
  },
  {
    "bedrock_region": "ap-northeast-1", // Tokyo
    "model_type": "claude",
    "model_id": "anthropic.claude-instant-v1",
    "maxOutputTokens": "4096"
  },    
  {
    "bedrock_region": "eu-central-1", // Europe (Frankfurt)
    "model_type": "claude",
    "model_id": "anthropic.claude-instant-v1",
    "maxOutputTokens": "4096"
    },
];

const claude2 = [
  {
    "bedrock_region": "us-west-2", // Oregon
    "model_type": "claude",
    "model_id": "anthropic.claude-v2:1",   
    "maxOutputTokens": "4096"
  },
  {
    "bedrock_region": "us-east-1", // N.Virginia
    "model_type": "claude",
    "model_id": "anthropic.claude-v2:1",
    "maxOutputTokens": "4096"
  }
];

const profile_of_LLMs = claude3_sonnet;
export class CdkVoicebotStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // s3 
    const s3Bucket = new s3.Bucket(this, `storage-${projectName}`,{
      bucketName: bucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false,
      versioned: false,
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [
            s3.HttpMethods.POST,
            s3.HttpMethods.PUT,
          ],
          allowedOrigins: ['*'],
        },
      ],
    });
    if(debug) {
      new cdk.CfnOutput(this, 'bucketName', {
        value: s3Bucket.bucketName,
        description: 'The nmae of bucket',
      });
      new cdk.CfnOutput(this, 's3Arn', {
        value: s3Bucket.bucketArn,
        description: 'The arn of s3',
      });
      new cdk.CfnOutput(this, 's3Path', {
        value: 's3://'+s3Bucket.bucketName,
        description: 'The path of s3',
      });
    }

    // DynamoDB for call log
    const callLogTableName = `db-call-log-for-${projectName}`;
    const callLogDataTable = new dynamodb.Table(this, `db-call-log-for-${projectName}`, {
      tableName: callLogTableName,
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'request_time', type: dynamodb.AttributeType.STRING }, 
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const callLogIndexName = `index-type-for-${projectName}`;
    callLogDataTable.addGlobalSecondaryIndex({ // GSI
      indexName: callLogIndexName,
      partitionKey: { name: 'request_id', type: dynamodb.AttributeType.STRING },
    });

    // copy web application files into s3 bucket
    new s3Deploy.BucketDeployment(this, `upload-HTML-for-${projectName}`, {
      sources: [s3Deploy.Source.asset("../html/")],
      destinationBucket: s3Bucket,
    });

    new cdk.CfnOutput(this, 'HtmlUpdateCommend', {
      value: 'aws s3 cp ../html/ ' + 's3://' + s3Bucket.bucketName + '/ --recursive',
      description: 'copy commend for web pages',
    });

    // cloudfront
    const distribution = new cloudFront.Distribution(this, `cloudfront-for-${projectName}`, {
      defaultBehavior: {
        origin: new origins.S3Origin(s3Bucket),
        allowedMethods: cloudFront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudFront.CachePolicy.CACHING_DISABLED,
        viewerProtocolPolicy: cloudFront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      priceClass: cloudFront.PriceClass.PRICE_CLASS_200,  
    });
    new cdk.CfnOutput(this, `distributionDomainName-for-${projectName}`, {
      value: distribution.domainName,
      description: 'The domain name of the Distribution',
    });

    const vpc = new ec2.Vpc(this, `vpc-for-${projectName}`, {
      vpcName: `vpc-for-${projectName}`,
      maxAzs: 1,
      cidr: "10.64.0.0/24",
      natGateways: 1,
      createInternetGateway: true,
      subnetConfiguration: [
        {
          name: `public-subnet-for-${projectName}`,
          subnetType: ec2.SubnetType.PUBLIC
        }, 
        {
          name: `private-subnet-for-${projectName}`,
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED
        },
      ],
    });

    const redisSubnetGroup = new elasticache.CfnSubnetGroup(
      this,`redis-subnet-group-for-${projectName}`,
      {
        description: "Subnet group for the redis cluster",
        subnetIds: vpc.publicSubnets.map((ps) => ps.subnetId),
        cacheSubnetGroupName: `redis-subnet-group-${projectName}`,
      }
    );

    const redisSecurityGroup = new ec2.SecurityGroup(this, `redis-sg-for-${projectName}`,
      {
        vpc: vpc,
        allowAllOutbound: true,
        description: "Security group for the redis cluster",
        securityGroupName: `redis-sg-for-${projectName}`,
      }
    );

    // Redis
    const redisCache = new elasticache.CfnCacheCluster(this, `redis-for-${projectName}`, {
      engine: 'redis',
      cacheNodeType: 'cache.t3.small',
      numCacheNodes: 1,
      clusterName: `redis-for-${projectName}`,
      vpcSecurityGroupIds: [redisSecurityGroup.securityGroupId],
      cacheSubnetGroupName: redisSubnetGroup.ref,
      engineVersion: "6.2",
    });
    
    redisCache.addDependsOn(redisSubnetGroup);
    new cdk.CfnOutput(this, `CacheEndpointUrl-for-${projectName}`, {
      value: redisCache.attrRedisEndpointAddress,
    });

    new cdk.CfnOutput(this, `CachePort-for-${projectName}`, {
      value: redisCache.attrRedisEndpointPort,
    });

    // Lambda (chat) - Role
    const roleLambda = new iam.Role(this, `role-lambda-chat-for-${projectName}`, {
      roleName: `role-lambda-chat-for-${projectName}-${region}`,
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal("lambda.amazonaws.com"),
        new iam.ServicePrincipal("bedrock.amazonaws.com"),
      )
    });
    roleLambda.addManagedPolicy({
      managedPolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
    });
    const BedrockPolicy = new iam.PolicyStatement({  // policy statement for sagemaker
      resources: ['*'],
      actions: ['bedrock:*'],
    });        
    roleLambda.attachInlinePolicy( // add bedrock policy
      new iam.Policy(this, `bedrock-policy-lambda-chat-for-${projectName}`, {
        statements: [BedrockPolicy],
      }),
    );     
    
    // role
    const role = new iam.Role(this, `api-role-for-${projectName}`, {
      roleName: `api-role-for-${projectName}-${region}`,
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com")
    });
    role.addToPolicy(new iam.PolicyStatement({
      resources: ['*'],
      actions: [
        'lambda:InvokeFunction',
        'cloudwatch:*'
      ]
    }));
    role.addManagedPolicy({
      managedPolicyArn: 'arn:aws:iam::aws:policy/AWSLambdaExecute',
    }); 

    // API Gateway
    const api = new apiGateway.RestApi(this, `api-chatbot-for-${projectName}`, {
      description: 'API Gateway for chatbot',
      endpointTypes: [apiGateway.EndpointType.REGIONAL],
      restApiName: 'rest-api-for-'+projectName,      
      binaryMediaTypes: ['application/pdf', 'text/plain', 'text/csv', 'image/png', 'image/jpeg'], 
      deployOptions: {
        stageName: stage,

        // logging for debug
        // loggingLevel: apiGateway.MethodLoggingLevel.INFO, 
        // dataTraceEnabled: true,
      },
    });  
    
    // cloudfront setting 
    distribution.addBehavior("/chat", new origins.RestApiOrigin(api), {
      cachePolicy: cloudFront.CachePolicy.CACHING_DISABLED,
      allowedMethods: cloudFront.AllowedMethods.ALLOW_ALL,  
      viewerProtocolPolicy: cloudFront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    });    
   
    new cdk.CfnOutput(this, `WebUrl-for-${projectName}`, {
      value: 'https://'+distribution.domainName+'/index.html',      
      description: 'The web url of request for chat',
    });

    // Lambda - Upload
    const lambdaUpload = new lambda.Function(this, `lambda-upload-for-${projectName}`, {
      runtime: lambda.Runtime.NODEJS_16_X, 
      functionName: `lambda-upload-for-${projectName}`,
      code: lambda.Code.fromAsset("../lambda-upload"), 
      handler: "index.handler", 
      timeout: cdk.Duration.seconds(10),
      environment: {
        bucketName: s3Bucket.bucketName,
        s3_prefix:  s3_prefix
      }      
    });
    s3Bucket.grantReadWrite(lambdaUpload);
    
    // POST method - upload
    const resourceName = "upload";
    const upload = api.root.addResource(resourceName);
    upload.addMethod('POST', new apiGateway.LambdaIntegration(lambdaUpload, {
      passthroughBehavior: apiGateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
      credentialsRole: role,
      integrationResponses: [{
        statusCode: '200',
      }], 
      proxy:false, 
    }), {
      methodResponses: [  
        {
          statusCode: '200',
          responseModels: {
            'application/json': apiGateway.Model.EMPTY_MODEL,
          }, 
        }
      ]
    }); 
    if(debug) {
      new cdk.CfnOutput(this, `ApiGatewayUrl-for-${projectName}`, {
        value: api.url+'upload',
        description: 'The url of API Gateway',
      }); 
    }

    // cloudfront setting  
    distribution.addBehavior("/upload", new origins.RestApiOrigin(api), {
      cachePolicy: cloudFront.CachePolicy.CACHING_DISABLED,
      allowedMethods: cloudFront.AllowedMethods.ALLOW_ALL,  
      viewerProtocolPolicy: cloudFront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    });    

    // Lambda - queryResult
    const lambdaQueryResult = new lambda.Function(this, `lambda-query-for-${projectName}`, {
      runtime: lambda.Runtime.NODEJS_16_X, 
      functionName: `lambda-query-for-${projectName}`,
      code: lambda.Code.fromAsset("../lambda-query"), 
      handler: "index.handler", 
      timeout: cdk.Duration.seconds(60),
      environment: {
        tableName: callLogTableName,
        indexName: callLogIndexName
      }      
    });
    callLogDataTable.grantReadWriteData(lambdaQueryResult); // permission for dynamo
    
    // POST method - query
    const query = api.root.addResource("query");
    query.addMethod('POST', new apiGateway.LambdaIntegration(lambdaQueryResult, {
      passthroughBehavior: apiGateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
      credentialsRole: role,
      integrationResponses: [{
        statusCode: '200',
      }], 
      proxy:false, 
    }), {
      methodResponses: [  
        {
          statusCode: '200',
          responseModels: {
            'application/json': apiGateway.Model.EMPTY_MODEL,
          }, 
        }
      ]
    }); 

    // cloudfront setting for api gateway    
    distribution.addBehavior("/query", new origins.RestApiOrigin(api), {
      cachePolicy: cloudFront.CachePolicy.CACHING_DISABLED,
      allowedMethods: cloudFront.AllowedMethods.ALLOW_ALL,  
      viewerProtocolPolicy: cloudFront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    });

    // Lambda - getHistory
    const lambdaGetHistory = new lambda.Function(this, `lambda-gethistory-for-${projectName}`, {
      runtime: lambda.Runtime.NODEJS_16_X, 
      functionName: `lambda-gethistory-for-${projectName}`,
      code: lambda.Code.fromAsset("../lambda-gethistory"), 
      handler: "index.handler", 
      timeout: cdk.Duration.seconds(60),
      environment: {
        tableName: callLogTableName
      }      
    });
    callLogDataTable.grantReadWriteData(lambdaGetHistory); // permission for dynamo
    
    // POST method - history
    const history = api.root.addResource("history");
    history.addMethod('POST', new apiGateway.LambdaIntegration(lambdaGetHistory, {
      passthroughBehavior: apiGateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
      credentialsRole: role,
      integrationResponses: [{
        statusCode: '200',
      }], 
      proxy:false, 
    }), {
      methodResponses: [  
        {
          statusCode: '200',
          responseModels: {
            'application/json': apiGateway.Model.EMPTY_MODEL,
          }, 
        }
      ]
    }); 

    // cloudfront setting for api gateway    
    distribution.addBehavior("/history", new origins.RestApiOrigin(api), {
      cachePolicy: cloudFront.CachePolicy.CACHING_DISABLED,
      allowedMethods: cloudFront.AllowedMethods.ALLOW_ALL,  
      viewerProtocolPolicy: cloudFront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    });

    // Lambda - deleteItems
    const lambdaDeleteItems = new lambda.Function(this, `lambda-deleteItems-for-${projectName}`, {
      runtime: lambda.Runtime.NODEJS_16_X, 
      functionName: `lambda-deleteItems-for-${projectName}`,
      code: lambda.Code.fromAsset("../lambda-delete-items"), 
      handler: "index.handler", 
      timeout: cdk.Duration.seconds(60),
      environment: {
        tableName: callLogTableName
      }      
    });
    callLogDataTable.grantReadWriteData(lambdaDeleteItems); // permission for dynamo
    
    // POST method - delete items
    const deleteItem = api.root.addResource("delete");
    deleteItem.addMethod('POST', new apiGateway.LambdaIntegration(lambdaDeleteItems, {
      passthroughBehavior: apiGateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
      credentialsRole: role,
      integrationResponses: [{
        statusCode: '200',
      }], 
      proxy:false, 
    }), {
      methodResponses: [  
        {
          statusCode: '200',
          responseModels: {
            'application/json': apiGateway.Model.EMPTY_MODEL,
          }, 
        }
      ]
    }); 

    // cloudfront setting for api gateway    
    distribution.addBehavior("/delete", new origins.RestApiOrigin(api), {
      cachePolicy: cloudFront.CachePolicy.CACHING_DISABLED,
      allowedMethods: cloudFront.AllowedMethods.ALLOW_ALL,  
      viewerProtocolPolicy: cloudFront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    });

    // stream api gateway
    // API Gateway
    const websocketapi = new apigatewayv2.CfnApi(this, `ws-api-for-${projectName}`, {
      description: 'API Gateway for chatbot using websocket',
      apiKeySelectionExpression: "$request.header.x-api-key",
      name: 'ws-api-for-'+projectName,
      protocolType: "WEBSOCKET", // WEBSOCKET or HTTP
      routeSelectionExpression: "$request.body.action",     
    });  
    websocketapi.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY); // DESTROY, RETAIN

    new cdk.CfnOutput(this, 'api-identifier', {
      value: websocketapi.attrApiId,
      description: 'The API identifier.',
    });

    const wss_url = `wss://${websocketapi.attrApiId}.execute-api.${region}.amazonaws.com/${stage}`;
    new cdk.CfnOutput(this, 'web-socket-url', {
      value: wss_url,
      
      description: 'The URL of Web Socket',
    });

    const connection_url = `https://${websocketapi.attrApiId}.execute-api.${region}.amazonaws.com/${stage}`;
    new cdk.CfnOutput(this, 'connection-url', {
      value: connection_url,
      
      description: 'The URL of connection',
    });

    // Lambda - chat (websocket)
    const roleLambdaWebsocket = new iam.Role(this, `role-lambda-chat-ws-for-${projectName}`, {
      roleName: `role-lambda-chat-ws-for-${projectName}-${region}`,
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal("lambda.amazonaws.com"),
        new iam.ServicePrincipal("bedrock.amazonaws.com"),
      )
    });
    roleLambdaWebsocket.addManagedPolicy({
      managedPolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
    });
    roleLambdaWebsocket.attachInlinePolicy( // add bedrock policy
      new iam.Policy(this, `bedrock-policy-lambda-chat-ws-for-${projectName}`, {
        statements: [BedrockPolicy],
      }),
    );        

    const apiInvokePolicy = new iam.PolicyStatement({ 
      // resources: ['arn:aws:execute-api:*:*:*'],
      resources: ['*'],
      actions: [
        'execute-api:Invoke',
        'execute-api:ManageConnections'
      ],
    });        
    roleLambdaWebsocket.attachInlinePolicy( 
      new iam.Policy(this, `api-invoke-policy-for-${projectName}`, {
        statements: [apiInvokePolicy],
      }),
    );  
    
    const lambdaChatWebsocket = new lambda.DockerImageFunction(this, `lambda-chat-ws-for-${projectName}`, {
      description: 'lambda for chat using websocket',
      functionName: `lambda-chat-ws-for-${projectName}`,
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../../lambda-chat-ws')),
      timeout: cdk.Duration.seconds(300),
      role: roleLambdaWebsocket,  
      environment: {
        s3_bucket: s3Bucket.bucketName,
        s3_prefix: s3_prefix,
        path: 'https://'+distribution.domainName+'/',   
        callLogTableName: callLogTableName,
        connection_url: connection_url,
        profile_of_LLMs:JSON.stringify(claude3_haiku),
        // profile_of_LLMs:JSON.stringify(claude3_sonnet),
      }
    });     
    lambdaChatWebsocket.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));  
    s3Bucket.grantRead(lambdaChatWebsocket); // permission for s3
    callLogDataTable.grantReadWriteData(lambdaChatWebsocket); // permission for dynamo 
    
    new cdk.CfnOutput(this, 'function-chat-ws-arn', {
      value: lambdaChatWebsocket.functionArn,
      description: 'The arn of lambda webchat.',
    }); 

    // lambda - provisioning
    const lambdaProvisioning = new lambda.Function(this, `lambda-provisioning-for-${projectName}`, {
      description: 'lambda to earn provisioning info',
      functionName: `lambda-provisioning-api-${projectName}`,
      handler: 'lambda_function.lambda_handler',
      runtime: lambda.Runtime.PYTHON_3_11,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda-provisioning')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        wss_url: wss_url,
      }
    });

    // POST method - provisioning
    const provisioning_info = api.root.addResource("provisioning");
    provisioning_info.addMethod('POST', new apiGateway.LambdaIntegration(lambdaProvisioning, {
      passthroughBehavior: apiGateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
      credentialsRole: role,
      integrationResponses: [{
        statusCode: '200',
      }], 
      proxy:false, 
    }), {
      methodResponses: [  
        {
          statusCode: '200',
          responseModels: {
            'application/json': apiGateway.Model.EMPTY_MODEL,
          }, 
        }
      ]
    }); 

    // cloudfront setting for provisioning api
    distribution.addBehavior("/provisioning", new origins.RestApiOrigin(api), {
      cachePolicy: cloudFront.CachePolicy.CACHING_DISABLED,
      allowedMethods: cloudFront.AllowedMethods.ALLOW_ALL,  
      viewerProtocolPolicy: cloudFront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    });

    // Poly Role
    const roleLambdaPolly = new iam.Role(this, `role-lambda-polly-for-${projectName}`, {
      roleName: `role-lambda-polly-for-${projectName}-${region}`,
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal("lambda.amazonaws.com"),
      )
    });
    roleLambdaPolly.addManagedPolicy({
      managedPolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
    });
    roleLambdaPolly.attachInlinePolicy( 
      new iam.Policy(this, `polly-api-invoke-policy-for-${projectName}`, {
        statements: [apiInvokePolicy],
      }),
    );  

    const PollyPolicy = new iam.PolicyStatement({  
      actions: ['polly:*'],
      resources: ['*'],
    });
    roleLambdaPolly.attachInlinePolicy(
      new iam.Policy(this, 'polly-policy', {
        statements: [PollyPolicy],
      }),
    ); 

    // lambda - polly
    const lambdaPolly = new lambda.Function(this, `lambda-polly-for-${projectName}`, {
      description: 'lambda polly for speech translation',
      functionName: `lambda-polly-${projectName}`,
      handler: 'lambda_function.lambda_handler',
      runtime: lambda.Runtime.PYTHON_3_11,
      role: roleLambdaPolly,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda-polly')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        s3_bucket: s3Bucket.bucketName,
      }
    });
    s3Bucket.grantReadWrite(lambdaPolly); // permission for s3

    const polySpeech = api.root.addResource("speech");
    polySpeech.addMethod('POST', new apiGateway.LambdaIntegration(lambdaPolly, {
      passthroughBehavior: apiGateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
      credentialsRole: role,
      integrationResponses: [{
        statusCode: '200',
      }], 
      proxy:false, 
    }), {
      methodResponses: [  
        {
          statusCode: '200',
          responseModels: {
            'application/json': apiGateway.Model.EMPTY_MODEL,
          }, 
        }
      ]
    }); 

    // cloudfront setting for api gateway    
    distribution.addBehavior("/speech", new origins.RestApiOrigin(api), {
      cachePolicy: cloudFront.CachePolicy.CACHING_DISABLED,
      allowedMethods: cloudFront.AllowedMethods.ALLOW_ALL,  
      viewerProtocolPolicy: cloudFront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    });

    // Lambda - greeting
    const lambdaGreeting = new lambda.DockerImageFunction(this, `lambda-greeting-for-${projectName}`, {
      description: 'lambda for greeting',
      functionName: `lambda-greeting-for-${projectName}`,
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../../lambda-greeting')),
      timeout: cdk.Duration.seconds(60),
      role: roleLambda,
      environment: {
        s3_bucket: bucketName,
        profile_of_LLMs:JSON.stringify(claude3_sonnet),
      }
    });     
  
    // POST method - greeting
    const greeting = api.root.addResource("greeting");
    greeting.addMethod('POST', new apiGateway.LambdaIntegration(lambdaGreeting, {
        passthroughBehavior: apiGateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
        credentialsRole: role,
        integrationResponses: [{
            statusCode: '200',
        }],
        proxy: true,
    }), {
        methodResponses: [
            {
                statusCode: '200',
                responseModels: {
                    'application/json': apiGateway.Model.EMPTY_MODEL,
                },
            }
        ]
    });
    
    distribution.addBehavior("/greeting", new origins.RestApiOrigin(api), {
        cachePolicy: cloudFront.CachePolicy.CACHING_DISABLED,
        allowedMethods: cloudFront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudFront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    });
    s3Bucket.grantReadWrite(lambdaGreeting);

    // Lambda - reading
    const lambdaReading = new lambda.DockerImageFunction(this, `lambda-reading-for-${projectName}`, {
      description: 'lambda for reading',
      functionName: `lambda-reading-for-${projectName}`,
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../../lambda-reading')),
      timeout: cdk.Duration.seconds(60),
      role: roleLambda,
      environment: {
        s3_bucket: bucketName,
        profile_of_LLMs:JSON.stringify(claude3_sonnet),
      }
    });     
  
    // POST method - reading
    const reading = api.root.addResource("reading");
    reading.addMethod('POST', new apiGateway.LambdaIntegration(lambdaReading, {
        passthroughBehavior: apiGateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
        credentialsRole: role,
        integrationResponses: [{
            statusCode: '200',
        }],
        proxy: true,
    }), {
        methodResponses: [
            {
                statusCode: '200',
                responseModels: {
                    'application/json': apiGateway.Model.EMPTY_MODEL,
                },
            }
        ]
    });
    
    distribution.addBehavior("/reading", new origins.RestApiOrigin(api), {
        cachePolicy: cloudFront.CachePolicy.CACHING_DISABLED,
        allowedMethods: cloudFront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudFront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    });
    s3Bucket.grantReadWrite(lambdaReading);

    // Lambda - translation
    const lambdaTranslation = new lambda.DockerImageFunction(this, `lambda-translation-for-${projectName}`, {
      description: 'lambda for translation',
      functionName: `lambda-translation-for-${projectName}`,
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../../lambda-translation')),
      timeout: cdk.Duration.seconds(60),
      role: roleLambda,
      environment: {
        s3_bucket: bucketName,
        profile_of_LLMs:JSON.stringify(claude3_sonnet),
      }
    });     
  
    // POST method - translation
    const translation = api.root.addResource("translation");
    translation.addMethod('POST', new apiGateway.LambdaIntegration(lambdaTranslation, {
        passthroughBehavior: apiGateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
        credentialsRole: role,
        integrationResponses: [{
            statusCode: '200',
        }],
        proxy: true,
    }), {
        methodResponses: [
            {
                statusCode: '200',
                responseModels: {
                    'application/json': apiGateway.Model.EMPTY_MODEL,
                },
            }
        ]
    });
    
    distribution.addBehavior("/translation", new origins.RestApiOrigin(api), {
        cachePolicy: cloudFront.CachePolicy.CACHING_DISABLED,
        allowedMethods: cloudFront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudFront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    });
    s3Bucket.grantReadWrite(lambdaTranslation);

    // Lambda - gesture
    const lambdaGesture = new lambda.DockerImageFunction(this, `lambda-gesture-for-${projectName}`, {
      description: 'lambda for gesture',
      functionName: `lambda-gesture-for-${projectName}`,
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../../lambda-gesture')),
      timeout: cdk.Duration.seconds(60),
      role: roleLambda,
      environment: {
        s3_bucket: bucketName,
        profile_of_LLMs:JSON.stringify(claude3_sonnet),
      }
    });     
  
    // POST method - gesture
    const gesture = api.root.addResource("gesture");
    gesture.addMethod('POST', new apiGateway.LambdaIntegration(lambdaGesture, {
        passthroughBehavior: apiGateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
        credentialsRole: role,
        integrationResponses: [{
            statusCode: '200',
        }],
        proxy: true,
    }), {
        methodResponses: [
            {
                statusCode: '200',
                responseModels: {
                    'application/json': apiGateway.Model.EMPTY_MODEL,
                },
            }
        ]
    });
    
    distribution.addBehavior("/gesture", new origins.RestApiOrigin(api), {
        cachePolicy: cloudFront.CachePolicy.CACHING_DISABLED,
        allowedMethods: cloudFront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudFront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    });
    s3Bucket.grantReadWrite(lambdaGesture);
    
    const integrationUri = `arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${lambdaChatWebsocket.functionArn}/invocations`;    
    const cfnIntegration = new apigatewayv2.CfnIntegration(this, `api-integration-for-${projectName}`, {
      apiId: websocketapi.attrApiId,
      integrationType: 'AWS_PROXY',
      credentialsArn: role.roleArn,
      connectionType: 'INTERNET',
      description: 'Integration for connect',
      integrationUri: integrationUri,
    });  

    new apigatewayv2.CfnRoute(this, `api-route-for-${projectName}-connect`, {
      apiId: websocketapi.attrApiId,
      routeKey: "$connect", 
      apiKeyRequired: false,
      authorizationType: "NONE",
      operationName: 'connect',
      target: `integrations/${cfnIntegration.ref}`,      
    }); 

    new apigatewayv2.CfnRoute(this, `api-route-for-${projectName}-disconnect`, {
      apiId: websocketapi.attrApiId,
      routeKey: "$disconnect", 
      apiKeyRequired: false,
      authorizationType: "NONE",
      operationName: 'disconnect',
      target: `integrations/${cfnIntegration.ref}`,      
    }); 

    new apigatewayv2.CfnRoute(this, `api-route-for-${projectName}-default`, {
      apiId: websocketapi.attrApiId,
      routeKey: "$default", 
      apiKeyRequired: false,
      authorizationType: "NONE",
      operationName: 'default',
      target: `integrations/${cfnIntegration.ref}`,      
    }); 

    new apigatewayv2.CfnStage(this, `api-stage-for-${projectName}`, {
      apiId: websocketapi.attrApiId,
      stageName: stage
    }); 

    // deploy components
    new componentDeployment(scope, `deployment-for-${projectName}`, websocketapi.attrApiId)    

    ///////////////////////////////////////////
    // Voice Stream
    ///////////////////////////////////////////
    // Lambda - redis
    const roleLambdaRedis = new iam.Role(this, `role-lambda-redis-for-${projectName}`, {
      roleName: `role-lambda-redis-for-${projectName}-${region}`,
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal("lambda.amazonaws.com"),
      )
    });
    roleLambdaRedis.addManagedPolicy({
      managedPolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
    });
    roleLambdaRedis.attachInlinePolicy( 
      new iam.Policy(this, `api-invoke-policy-of-redis-for-${projectName}`, {
        statements: [apiInvokePolicy],
      }),
    );  

    // For Redis
    roleLambdaRedis.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName("AmazonElastiCacheFullAccess")
    );
    roleLambdaRedis.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSLambdaENIManagementAccess"
      )
    );

    const lambdaSG = new ec2.SecurityGroup(this, `lambda-sg-for-${projectName}`, {
      description: `security group of lambda for ${projectName}`,      
      vpc: vpc,
      allowAllOutbound: true,
      securityGroupName: `lambda-sg-for-${projectName}`,
    });

    lambdaSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.allTcp(), 'allow all access from the world');
    // Peer.anyIpv4(), Peer.anyIpv6(), Peer.ipv4(), Peer.ipv6(), Peer.prefixList(), Peer.securityGroupId(), EndpointGroup.connectionsPeer(), ipv4('10.200.0.0/24')
    // ec2.Port.tcp(80) allTcp(), allTraffic(), tcp(port), ec2.Port.tcp(5439)

    lambdaSG.connections.allowTo(
      redisSecurityGroup,
      ec2.Port.tcp(6379),
      "Allow this lambda function connect to the redis cache"
    );
    
    // lambda - redis for voice  
    const lambdaRedis = new lambda.DockerImageFunction(this, `lambda-redis-for-${projectName}`, {
      description: 'lambda for redis',
      functionName: `lambda-redis-for-${projectName}`,
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../../lambda-redis')),
      timeout: cdk.Duration.seconds(300),
      role: roleLambdaRedis,
      vpc: vpc,  // for Redis
      securityGroups: [lambdaSG],
      environment: {
        redisAddress: redisCache.attrRedisEndpointAddress,
        redisPort: redisCache.attrRedisEndpointPort
      }
    });
    
    // POST method - redis
    const redis_info = api.root.addResource("redis");
    redis_info.addMethod('POST', new apiGateway.LambdaIntegration(lambdaRedis, {
      passthroughBehavior: apiGateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
      credentialsRole: role,
      integrationResponses: [{
        statusCode: '200',
      }], 
      proxy:false, 
    }), {
      methodResponses: [  
        {
          statusCode: '200',
          responseModels: {
            'application/json': apiGateway.Model.EMPTY_MODEL,
          }, 
        }
      ]
    }); 

    // cloudfront setting for redis api
    distribution.addBehavior("/redis", new origins.RestApiOrigin(api), {
      cachePolicy: cloudFront.CachePolicy.CACHING_DISABLED,
      allowedMethods: cloudFront.AllowedMethods.ALLOW_ALL,  
      viewerProtocolPolicy: cloudFront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    }); 

    // voice stream api gateway
    // API Gateway
    const voiceWebsocketapi = new apigatewayv2.CfnApi(this, `voice-ws-api-for-${projectName}`, {
      description: 'API Gateway for voice using websocket',
      apiKeySelectionExpression: "$request.header.x-api-key",
      name: 'voice-ws-api-for-'+projectName,
      protocolType: "WEBSOCKET", // WEBSOCKET or HTTP
      routeSelectionExpression: "$request.body.action",     
    });  
    voiceWebsocketapi.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY); // DESTROY, RETAIN

    new cdk.CfnOutput(this, 'voice-api-identifier', {
      value: voiceWebsocketapi.attrApiId,
      description: 'The Voice API identifier.',
    });

    const voice_wss_url = `wss://${voiceWebsocketapi.attrApiId}.execute-api.${region}.amazonaws.com/${stage}`;
    new cdk.CfnOutput(this, 'voice-web-socket-url', {
      value: voice_wss_url,
      
      description: 'The URL of Voice Web Socket',
    });

    const voice_connection_url = `https://${voiceWebsocketapi.attrApiId}.execute-api.${region}.amazonaws.com/${stage}`;
    new cdk.CfnOutput(this, 'voice-connection-url', {
      value: voice_connection_url,
      
      description: 'The URL of voice connection',
    });

    // Lambda - voice (websocket)
    const roleLambdaVoiceWebsocket = new iam.Role(this, `role-lambda-voice-ws-for-${projectName}`, {
      roleName: `role-lambda-voice-ws-for-${projectName}-${region}`,
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal("lambda.amazonaws.com"),
      )
    });
    roleLambdaVoiceWebsocket.addManagedPolicy({
      managedPolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
    });
    roleLambdaVoiceWebsocket.attachInlinePolicy( 
      new iam.Policy(this, `voice-api-invoke-policy-for-${projectName}`, {
        statements: [apiInvokePolicy],
      }),
    );  

    // For Redis
    roleLambdaVoiceWebsocket.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName("AmazonElastiCacheFullAccess")
    );

    roleLambdaVoiceWebsocket.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSLambdaENIManagementAccess"
      )
    );
        
    const lambdaVoiceWebsocket = new lambda.DockerImageFunction(this, `lambda-voice-ws-for-${projectName}`, {
      description: 'lambda for voice using websocket',
      functionName: `lambda-voice-ws-for-${projectName}`,
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../../lambda-voice-ws')),
      timeout: cdk.Duration.seconds(300),
      role: roleLambdaVoiceWebsocket,  
      vpc: vpc,  // for Redis
      securityGroups: [lambdaSG],
      // allowPublicSubnet: true,
      environment: {
        voice_connection_url: voice_connection_url, 
        redisAddress: redisCache.attrRedisEndpointAddress,
        redisPort: redisCache.attrRedisEndpointPort
      }
    });     
    lambdaVoiceWebsocket.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));  
    
    new cdk.CfnOutput(this, 'function-voice-ws-arn', {
      value: lambdaVoiceWebsocket.functionArn,
      description: 'The arn of lambda voice webchat.',
    }); 

    const voiceIntegrationUri = `arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${lambdaVoiceWebsocket.functionArn}/invocations`;    
    const cfnVoiceIntegration = new apigatewayv2.CfnIntegration(this, `voice-api-integration-for-${projectName}`, {
      apiId: voiceWebsocketapi.attrApiId,
      integrationType: 'AWS_PROXY',
      credentialsArn: role.roleArn,
      connectionType: 'INTERNET',
      description: 'Integration for connect',
      integrationUri: voiceIntegrationUri,
    });  

    new apigatewayv2.CfnRoute(this, `voice-api-route-for-${projectName}-connect`, {
      apiId: voiceWebsocketapi.attrApiId,
      routeKey: "$connect", 
      apiKeyRequired: false,
      authorizationType: "NONE",
      operationName: 'connect',
      target: `integrations/${cfnVoiceIntegration.ref}`,      
    }); 

    new apigatewayv2.CfnRoute(this, `voice-api-route-for-${projectName}-disconnect`, {
      apiId: voiceWebsocketapi.attrApiId,
      routeKey: "$disconnect", 
      apiKeyRequired: false,
      authorizationType: "NONE",
      operationName: 'disconnect',
      target: `integrations/${cfnVoiceIntegration.ref}`,      
    }); 

    new apigatewayv2.CfnRoute(this, `voice-api-route-for-${projectName}-default`, {
      apiId: voiceWebsocketapi.attrApiId,
      routeKey: "$default", 
      apiKeyRequired: false,
      authorizationType: "NONE",
      operationName: 'default',
      target: `integrations/${cfnVoiceIntegration.ref}`,      
    }); 

    new apigatewayv2.CfnStage(this, `voice-api-stage-for-${projectName}`, {
      apiId: voiceWebsocketapi.attrApiId,
      stageName: stage
    }); 

    // lambda - voice provisioning 
    const lambdaVoiceProvisioning = new lambda.Function(this, `lambda-voice-provisioning-for-${projectName}`, {
      description: 'lambda to earn voice provisioning info',
      functionName: `lambda-voice-provisioning-api-${projectName}`,
      handler: 'lambda_function.lambda_handler',
      runtime: lambda.Runtime.PYTHON_3_11,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda-voice-provisioning')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        voice_wss_url: voice_wss_url,
      }
    });

    // POST method - provisioning
    const voice_provisioning_info = api.root.addResource("voice_provisioning");
    voice_provisioning_info.addMethod('POST', new apiGateway.LambdaIntegration(lambdaVoiceProvisioning, {
      passthroughBehavior: apiGateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
      credentialsRole: role,
      integrationResponses: [{
        statusCode: '200',
      }], 
      proxy:false, 
    }), {
      methodResponses: [  
        {
          statusCode: '200',
          responseModels: {
            'application/json': apiGateway.Model.EMPTY_MODEL,
          }, 
        }
      ]
    }); 

    // cloudfront setting for provisioning api
    distribution.addBehavior("/voice_provisioning", new origins.RestApiOrigin(api), {
      cachePolicy: cloudFront.CachePolicy.CACHING_DISABLED,
      allowedMethods: cloudFront.AllowedMethods.ALLOW_ALL,  
      viewerProtocolPolicy: cloudFront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    });

    // deploy components
    new voiceComponentDeployment(scope, `voice-deployment-for-${projectName}`, voiceWebsocketapi.attrApiId)   
  
  }
}

export class componentDeployment extends cdk.Stack {
  constructor(scope: Construct, id: string, appId: string, props?: cdk.StackProps) {    
    super(scope, id, props);

    new apigatewayv2.CfnDeployment(this, `api-deployment-for-${projectName}`, {
      apiId: appId,
      description: "deploy api gateway using websocker",  // $default
      stageName: stage
    });   
  }
} 

export class voiceComponentDeployment extends cdk.Stack {
  constructor(scope: Construct, id: string, appId: string, props?: cdk.StackProps) {    
    super(scope, id, props);

    new apigatewayv2.CfnDeployment(this, `voice-api-deployment-for-${projectName}`, {
      apiId: appId,
      description: "deploy voice api gateway using websocker",  // $default
      stageName: stage
    });   
  }
} 
