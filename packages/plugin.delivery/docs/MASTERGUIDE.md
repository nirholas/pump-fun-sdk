Plugin Manifest
The SperaxOS Plugin Manifest is a crucial configuration file used to describe and define the basic information and behavior of a SperaxOS plugin. The Manifest file serves as the "identity card" of the plugin, providing the necessary information for the SperaxOS platform to handle and integrate the plugin.

Introduction
The Manifest file is typically provided in JSON format to ensure that the SperaxOS platform can correctly parse and use the plugin:

Identify the plugin: The Manifest contains the unique identifier (identifier) of the plugin, which is used to distinguish different plugins within the SperaxOS platform.
Configure metadata: The plugin's metadata (meta), such as title, description, tags, and avatar, is used to display the plugin's information in the SperaxOS user interface, helping users understand the purpose of the plugin.
Set plugin description: By specifying the system role (systemRole), we can set the plugin's description to help the model better understand the functionality and purpose of the plugin.
Define interfaces: By declaring API interfaces (api) in the Manifest, the plugin can clearly inform the SperaxOS platform about the functionality and services it can provide.
Specify UI display: The plugin's UI configuration (ui) determines how the plugin is displayed in SperaxOS, including its mode, size, and the URL to load.
Manifest Schema
The SperaxOS plugin system allows developers to define the configuration and behavior of plugins using the Manifest file. Below is a detailed description of the structure of the Manifest file.

The manifest is a JSON file containing the following fields:

typescript
{
  "api": Array<PluginApi>,       // Array defining the plugin's API
  "author": String,              // Plugin author, optional
  "createAt": String,            // Plugin creation date, optional
  "gateway": String,             // Plugin gateway address, optional
  "homepage": String,            // Plugin homepage URL, optional
  "identifier": String,          // Plugin unique identifier
  "meta": {                      // Plugin metadata
    "avatar": String,            // Plugin avatar URL, optional
    "description": String,       // Plugin description, optional
    "tags": Array<String>,       // Array of plugin tags, optional
    "title": String              // Title describing the plugin, optional
  },
  "openapi": String,             // Plugin OpenAPI specification URL, optional
  "settings": JSONSchema,        // JSON Schema for plugin settings, optional
  "systemRole": String,          // Plugin system role, optional
  "type": Enum['default', 'markdown', 'standalone'], // Plugin type, optional
  "ui": {                        // Plugin UI configuration, optional
    "height": Number,            // UI height, optional
    "mode": Enum['iframe', 'module'], // UI mode, optional
    "url": String,               // UI URL
    "width": Number              // UI width, optional
  }
}
An example is as follows:

json
{
  "$schema": "../node_modules/@sperax/plugin-sdk/schema.json",
  "api": [
    {
      "url": "http://localhost:3400/api/clothes",
      "name": "recommendClothes",
      "description": "Recommend clothes based on the user's mood",
      "parameters": {
        "properties": {
          "mood": {
            "description": "The user's current mood, optional values are: happy, sad, anger, fear, surprise, disgust",
            "enums": ["happy", "sad", "anger", "fear", "surprise", "disgust"],
            "type": "string"
          },
          "gender": {
            "type": "string",
            "enum": ["man", "woman"],
            "description": "User's gender, this information is known only after asking the user"
          }
        },
        "required": ["mood", "gender"],
        "type": "object"
      }
    }
  ],
  "gateway": "http://localhost:3400/api/gateway",
  "identifier": "chat-plugin-template",
  "ui": {
    "url": "http://localhost:3400",
    "height": 200
  },
  "version": "1"
}

SperaxOS Plugin Types
SperaxOS's plugin mechanism provides developers with powerful extension capabilities, allowing custom functions and interactions to be embedded in chats. Currently, SperaxOS supports three types of plugins: default, markdown, and standalone. Here is a brief introduction to these three types of plugins:

Default Plugin
The default plugin is the default type, mainly used for pure backend-driven plugins and display-oriented plugins, without interactive capabilities such as editing or deletion. They are suitable for scenarios that do not require complex user interaction and mainly rely on GPT for content summarization.

For example, the officially implemented web crawler plugin:

web-crawler

Search engine plugin:

search-engine

And all compatible OpenAI ChatGPT plugins are of the default type.

Markdown Plugin
The markdown plugin type allows plugins to return content in Markdown format directly displayed in the chat. This rendering method is suitable for scenarios where the results are clear and do not need to be sent to AI for processing again. For example, when a user asks for specific information, the plugin can directly return a Markdown message containing the answer, without the need for additional AI summarization process. In addition, the configuration associated with this type can be set to no longer trigger AI messages, thus avoiding unnecessary AI calls.

clothes

Standalone Plugin
The standalone plugin type is designed to support complex interactions. These plugins can fully control the interaction logic and run in the form of independent applications. They are suitable for scenarios that require rich user interaction, such as form filling, games, or other multi-step operations. Standalone plugins can decide whether to trigger AI messages on their own, and can even trigger AI replies programmatically.

The standalone type of plugin is the biggest difference between SperaxOS and ChatGPT plugin systems. It is because of the existence of this type of plugin that we can achieve more complex conversation interaction experiences through plugins.

For example, the officially implemented clock plugin is a standard Standalone plugin, which is characterized by not containing any backend API and being implemented purely on the frontend.


How to Choose
When developing SperaxOS plugins, choosing the correct plugin type is crucial to achieving the expected user experience. Here is a guide to help you choose the most suitable plugin type based on different scenarios and requirements.

Default Plugin
Choose the default plugin if your needs fit the following scenarios:

You want the plugin's content to be summarized or further processed by GPT.
Your plugin requires simple backend processing and needs to be closely integrated with GPT's replies.
Your plugin is mainly used for content display, may require custom frontend display, but does not involve user interaction with the plugin (such as clicking a confirm button).
For example, a website content summarization plugin, where the user provides a link, and the plugin returns a summary, which is then interpreted or supplemented by GPT.

Markdown Plugin
Choose the markdown plugin if your needs fit the following scenarios:

You need to quickly return clear, formatted text results.
You do not need complex frontend interaction, but want the results to support rich Markdown format display.
You want to avoid unnecessary AI summarization or processing and directly display the results to the user.
Your plugin is for answering simple and specific queries, such as time or name queries.
For example, a plugin to query the current time, where the user asks "What time is it in Beijing now?" and the plugin returns a formatted Markdown message displaying the current time.

Standalone Plugin
Choose the standalone plugin if your needs fit the following scenarios:

Your plugin needs to provide a complex, interactive user experience.
You want full control over the interaction logic, including whether to trigger subsequent AI messages.
Your plugin is an independent application, possibly including forms, games, or other complex functions.
You need a completely custom frontend display and want to control AI behavior programmatically.
For example, a plugin for an online booking system, where users can select a date and time through a form, and after submission, the plugin processes the booking and provides feedback.

When choosing a plugin type, consider the complexity of user interaction, the degree of dependence on AI, and the requirements for displaying content. Each type of plugin has its specific advantages and use cases. Choosing wisely can help you better meet the needs of users and provide an excellent chat experience.

Summary
Through these three types of plugins, SperaxOS provides developers with flexible choices for plugin development, covering chat experiences from simple display to complex interaction. As a developer, you can choose the most suitable plugin type for development based on your own needs and scenarios, to enhance user interaction and satisfaction.

SperaxOS Plugin Invoking Mechanism
The SperaxOS plugin system triggers plugins through the Function Call mechanism, enabling chatbots to interact with external APIs to enhance user experience. The following is a detailed explanation of the plugin triggering process.

Basic Principles of Function Call
Function Call is a new feature that allows developers to describe functions within the GPT model, enabling the model to intelligently generate the JSON parameters required to call these functions. This mechanism extends the capabilities of large models by improving the reliability of their connections with external tools and APIs.

Plugin Trigger Steps
User Input: The user makes a request to SperaxOS, such as querying the weather or adding a to-do item.
Intent Recognition: The model analyzes the user's input to determine if a plugin needs to be invoked to handle the request.
Generate Function Call: If a plugin intervention is required, the model generates a Function Call request containing the necessary parameters.
Send Request: SperaxOS sends the Function Call as an API request to the designated plugin server.
Process Request: The plugin server receives the Function Call request, processes it, and prepares response data.
Return Response: The plugin server returns the processed data to SperaxOS in JSON format.
Model Processes Plugin Response: The model receives the plugin's response data and continues interacting with the user based on this data.
Example Process: Weather Forecast Plugin
Here is a detailed process for triggering a weather forecast plugin, including JSON request and response examples based on the OpenAI data structure.

1. User Inquiry
The user makes the following request to SperaxOS:

json
{
  "content": "Will my outdoor activities be affected by the weather tomorrow?",
  "role": "user"
}
2. Model Generates Function Call
The model recognizes that the user wants to know the weather for tomorrow and generates a Function Call to request weather forecast data from the plugin:

json
{
  "content": {
    "arguments": {
      "city": "user's location",
      "date": "tomorrow's date"
    }
  },
  "name": "queryWeatherForecast",
  "role": "function"
}
3. SperaxOS Sends API Request
SperaxOS converts the above Function Call into an API request to the weather forecast plugin:

http
POST /weather-forecast HTTP/1.1
Host: plugin.example.com
Content-Type: application/json

{
  "city": "user's location",
  "date": "tomorrow's date"
}
4. Plugin Processes Request and Returns Data
The weather forecast plugin processes the request and returns the weather forecast for tomorrow:

json
{
  "content": {
    "forecast": {
      "city": "user's location",
      "date": "tomorrow's date",
      "condition": "sunny",
      "temperature": {
        "high": 25,
        "low": 18
      },
      "advice": "The temperature is suitable for outdoor activities. It is recommended to wear light clothing and sunglasses."
    }
  },
  "name": "queryWeatherForecast",
  "role": "function"
}
5. Model Receives Response and Interacts with User
After receiving the plugin's response, the model interacts with the user based on the returned data:

json
{
  "content": "Based on the weather forecast provided by the plugin, the weather in your location tomorrow will be sunny with a high of 25 degrees and a low of 18 degrees. The temperature is suitable for outdoor activities. It is recommended to wear light clothing and sunglasses.",
  "role": "assistant"
}
The user sees the model's response and prepares accordingly based on the advice.

Considerations
The design of Function Call needs to accurately reflect the user's intent and the required parameters.
Plugins must be able to securely and efficiently handle requests from SperaxOS and provide accurate responses.
In the latest implementation of OpenAI, Function Call has been updated to tool_calls. SperaxOS has completed compatibility adaptation to accommodate the new implementation.
Conclusion
The Function Call mechanism provides a flexible and efficient tool triggering mechanism for SperaxOS plugins, enabling the SperaxOS assistant to interact with external services in a more intelligent manner. This mechanism not only enhances user experience but also provides developers with vast innovation opportunities.

Overview of Plugin Communication Mechanism
Server Communication
For plugins of type default and markdown, you need to provide a backend service (standalone plugins can be pure frontend applications) to exchange data and process requests with the SperaxOS core.

The following will introduce the implementation principles and key details of server communication between the SperaxOS core and plugins.

Plugin Server Communication Process
The server communication between the SperaxOS core and plugins is coordinated through a middleware layer, namely the Plugin Gateway, to ensure the security and flexibility of communication. It also provides a standardized protocol to manage requests and responses.

Request Initialization: The SperaxOS core sends a request to the Gateway via HTTP POST, carrying a PluginRequestPayload containing the plugin identifier, API name, parameters, and other information.
Gateway Processing: Upon receiving the request, the Gateway parses the PluginRequestPayload in the request body and performs parameter validation.
Request Handling and Response: After successful validation, the Gateway calls the plugin's server based on the API name and parameters in the request, obtains the response, encapsulates the processing result as response data, and sends it back to the SperaxOS core via HTTP response.
Error Handling: If an error occurs during request processing, the Gateway generates an error response, including the error type and message, and returns it to the SperaxOS core.
Gateway Communication Implementation Details
The following are key implementation details of the SperaxOS plugin server:

Request Payload Processing: The Gateway determines the plugin's identity by parsing the identifier in the PluginRequestPayload and executes the corresponding API logic based on the apiName.
Plugin Manifest Retrieval: If the request payload does not include the plugin manifest, the Gateway retrieves it from the Plugin Store Index to ensure correct identification and functionality of the plugin.
Parameter Validation: The Gateway validates the parameters in the request based on the API parameter pattern defined in the plugin manifest to ensure their validity and security.
Setting Handling: The Gateway adds the plugin's requested settings to the request header, allowing the plugin to retrieve the settings, such as API keys or other authentication information, using the getPluginSettingsFromRequest method.
OpenAPI Support: If the plugin manifest specifies an OpenAPI manifest, the Gateway will utilize SwaggerClient to interact with third-party services defined in the OpenAPI specification.
Error Handling
Error handling in server communication is crucial. The Gateway defines various error types, such as PluginErrorType.MethodNotAllowed indicating an unsupported request method, and PluginErrorType.PluginGatewayError indicating a gateway error, ensuring clear error feedback to the SperaxOS core in case of issues. For detailed error types, please refer to: Server Error Types

Frontend Communication
The frontend communication between the SperaxOS core and plugins is based on the HTML5 window.postMessage API, which allows secure communication between pages from different origins. In this mechanism, the SperaxOS core can securely exchange information with embedded plugins (usually through <iframe> embedding).

Frontend Communication Process
The following is an overview of the communication process:

Initialization of Communication: When the plugin is loaded and ready to interact with the SperaxOS core, it can use the speraxOS.getPluginPayload() method to obtain initialization data. Behind the scenes, the plugin listens for the message event, waiting for the initialization message from the SperaxOS core, and upon receiving it, returns the parsed plugin parameters, name, settings, and status.
Receiving Plugin Payload: The plugin receives initialization data from the SperaxOS core by calling the speraxOS.getPluginPayload() method. This method internally listens for the message event, waiting for and processing the message containing the required plugin data sent by the SperaxOS core.
Retrieving and Updating Basic Information: The plugin can call methods such as speraxOS.setPluginSettings(settings), speraxOS.setPluginMessage(content), speraxOS.setPluginState(key, value) to update settings, message content, and plugin state.
Custom Trigger Actions: For standalone plugins, custom control of AI message triggering and assistant message creation can be achieved using methods like speraxOS.triggerAIMessage(id) and `speraxOS.createAssistantMessage(content), providing a richer product experience.
In summary, communication between SperaxOS and plugins is achieved through asynchronous message exchange using the postMessage API. The plugin can request data, receive data, update state, trigger messages, etc., while the SperaxOS core is responsible for responding to these requests and providing the required data. This mechanism allows plugins to operate independently and effectively communicate with the SperaxOS core.

Additionally, we provide the speraxOS method in the SDK to simplify plugin frontend communication. Through the series of methods provided by speraxOS, communication details are abstracted, enabling plugins to interact with the SperaxOS core using a concise API.

OpenAPI
SperaxOS's plugin mechanism supports the OpenAPI specification, which is a standard for defining and describing RESTful APIs. By using OpenAPI, developers can create a clear, language-agnostic API description to facilitate the correct implementation and usage of the API. Here is an overview of SperaxOS's support for OpenAPI:

SperaxOS Plugin Compatibility
SperaxOS's plugin system is fully compatible with OpenAPI documents. This means that when you create a SperaxOS plugin, you only need to follow the following steps to convert an OpenAPI service into a session plugin:

Build the API - Develop your service API, ensuring that it can handle requests from SperaxOS and return appropriate responses.
OpenAPI Document - Use the OpenAPI specification (in YAML or JSON format) to describe your API. This document should provide detailed information about the endpoints, parameters, response formats, etc., of your API.
Create a Plugin Manifest - Create a manifest.json plugin manifest file for SperaxOS, which includes the plugin's metadata, such as the plugin's name, description, and most importantly, fill in the URL of your OpenAPI document in the openapi field.
OpenAPI Specification
The OpenAPI specification is a standard for describing the structure and behavior of RESTful APIs. This specification allows developers to define the following:

Basic information about the API (such as title, description, and version)
URL of the API server
Available endpoints (paths) and operations (e.g., GET, POST, PUT, DELETE)
Input and output parameters for each operation
Authentication methods (e.g., no authentication, HTTP basic authentication, OAuth2)
Common response messages and error codes
You can view an example of an OpenAPI document for the Weather Plugin here: openapi.json.

For a detailed introduction to OpenAPI, you can refer to the OpenAPI Specification.

Integrating OpenAPI with SperaxOS
Once your API and plugin manifest file are ready, you can integrate them with SperaxOS. In the SperaxOS UI, users can install your plugin and interact with your service through the endpoints defined in the OpenAPI document. Your OpenAPI document will guide SperaxOS on how to communicate with your API, ensuring the correct interpretation and handling of requests and responses.

For example, the AskYourPDF plugin:

We strive to achieve integration with OpenAPI in SperaxOS's plugin mechanism to ensure that your service can seamlessly integrate with SperaxOS, providing a rich user experience. By following the OpenAPI specification, you can ensure that your API documentation is accurate, consistent, and easy to use.

Default Type Plugin
The default plugin is the default type of plugin, mainly used for pure backend-driven plugins and display-oriented plugins, without rich interactive capabilities such as editing or deletion. They are suitable for scenarios that do not require complex user interaction and mainly rely on GPT for content summarization.

For example, the officially implemented website crawler plugin:

web-crawler

Search engine plugin:

search-engine

And all compatible OpenAI ChatGPT plugins are of the default type.

How to Choose
By default, we recommend choosing the default type plugin because default plugins cover common mainstream scenarios, such as:

You want the plugin's content to be summarized or further processed by GPT.
Your plugin requires simple backend processing and tight integration with GPT's responses.
The plugin you need is mainly used for content display, may require custom frontend display, but does not involve user interaction with the plugin (such as clicking confirm buttons);
For example, a website content summarization plugin, where the user provides a link, and the plugin returns summary information, which is then interpreted or supplemented by GPT.

Developing Default Plugins
The tutorial in the quick start has already introduced the development process of default plugins, so it will not be repeated here.

Markdown Type Plugin
The Markdown plugin type allows plugins to return content in Markdown format directly displayed in the chat. This rendering method is suitable for scenarios where the result is clear and does not need to be sent to AI for processing again. For example, when a user asks for specific information, the plugin can directly return a Markdown message containing the answer, without the need for additional AI summarization process. In addition, plugins of this type by default will not trigger AI messages, thus avoiding unnecessary AI calls.

clothes

How to Choose
You can choose the markdown plugin if your needs align with the following scenarios:

You need to quickly return clear, formatted text results.
You do not require complex front-end interactions, but want the results to support rich Markdown format display.
You want to avoid unnecessary AI summarization or processing and directly display the results to the user.
Your plugin is for answering simple and specific queries, such as time or name queries.
For example, a plugin that queries the current time, when a user asks "What time is it in Beijing now?" the plugin returns a formatted Markdown message displaying the current time.

Configuring as a Markdown Plugin
Configure the Manifest
In the plugin's manifest.json file, set the type field to markdown.

json
{
  "type": "markdown"
}
Adjust the Output Request Format
Additionally, you need to return your request in plain text in Markdown format:

ts
export default async (req: Request) => {
  // ... Other implementation code

  return new Response(
    `Since your mood is ${result.mood}, I recommend you wear ${result.clothes
      .map((c) => c.name)
      .join('、')}.`,
  );
};
The effect is as follows:

clothes

Plugin Example
You can view the Markdown Plugin Example in the chat-plugin-template to understand the implementation of the markdown type plugin.

Standalone Plugin
The standalone plugin represents a powerful and flexible type of plugin in the SperaxOS plugin ecosystem, allowing developers to build independent application-level interactive experiences. These plugins completely control user interaction logic independently of SperaxOS's basic conversation flow. They are suitable for scenarios that require deep user involvement, such as form filling, games, or any application requiring multi-step interaction. The uniqueness of Standalone plugins lies in their ability to independently decide whether and when to trigger AI messages, and even trigger AI replies programmatically.

The standalone type of plugin is the biggest difference between SperaxOS and the ChatGPT plugin system. It is because of the existence of this type of plugin that we can achieve more complex conversation interaction experiences through plugins. For example, the official Clock plugin is a standard Standalone plugin, which does not include any backend API and is implemented purely on the frontend.


Advantages and Scenarios
The Standalone plugin mechanism is very friendly to pure frontend applications, allowing developers to integrate with SperaxOS without changing existing code. This mechanism not only provides a broad development space for frontend developers but also enables richer interaction modes than ChatGPT plugins.

If your plugin scenario meets any of the following conditions, a Standalone plugin may be your ideal choice:

The plugin needs to provide a rich and complex interactive experience.
The plugin needs complete control over interaction logic, including the timing of triggering AI messages.
The plugin is a standalone application, possibly including forms, games, or other complex functionality.
The plugin requires completely custom frontend display and wants to programmatically control AI behavior.
Standalone Plugin Communication Mechanism
As a Standalone plugin, you need to pay special attention to the communication mechanism with SperaxOS. To achieve independent interaction logic, you need to use the Plugin SDK to listen for messages, send status updates, and complete interactions.

The communication between Standalone plugins and SperaxOS is achieved through a carefully designed API and event listening mechanism. These API methods encapsulate the internal communication details, providing a concise and powerful way to exchange data and trigger behavior. The following is a detailed explanation of the Standalone plugin communication mechanism:

Initializing Communication
When a Standalone plugin loads and is ready to interact with SperaxOS, it first needs to obtain initialization data. This can be achieved through the speraxOS.getPluginPayload() method. This method internally listens for the message event, waiting for the initialization message sent by SperaxOS, and returns the parsed data upon receiving the message, including plugin parameters, name, settings, and status.

Getting and Setting Plugin Messages
Using the speraxOS.getPluginMessage() method, the plugin can request the current message content. This method also relies on the message event listener and returns the message content upon receiving the message sent by SperaxOS.
To update the plugin message content, the plugin can call the speraxOS.setPluginMessage(content) method. The content parameter is the new message content the plugin wishes to set.

Getting and Setting Plugin State
Getting and setting plugin state can be done through the speraxOS.getPluginState(key) and speraxOS.setPluginState(key, value) methods. This allows the plugin to maintain and manage its own state information.

Getting and Updating Plugin Settings
The plugin can request its settings by calling the speraxOS.getPluginSettings() method. If the plugin needs to update its settings, it can use the speraxOS.setPluginSettings(settings) method to send the new settings data to SperaxOS. The settings parameter contains the information to be updated.

Triggering AI Messages and Creating Assistant Messages
The plugin can use the speraxOS.triggerAIMessage(id) and speraxOS.createAssistantMessage(content) methods to trigger AI messages or create new assistant messages, thereby interacting with AI.

Configuring as a Standalone Plugin
Configuring the Manifest
To configure your plugin as a Standalone type, you need to specify the type field as standalone in the plugin's manifest.json file.

json5
{
  // Other configurations...
  type: 'standalone',
}
Modifying Plugin Rendering Implementation
Since the communication mechanism of Standalone plugins is different from other types of plugins, you need to modify the frontend implementation of the plugin. Use the speraxOS instance object to communicate with the SperaxOS core. Also, the entire lifecycle of the plugin application needs to be managed by you.

Plugin Examples and Templates
To help you better understand and develop Standalone plugins, you can refer to the following resources:

Standalone Plugin Template - Understand the basic structure and configuration of Standalone type plugins.
Clock Time - An example of a Standalone plugin that is implemented purely on the frontend without the need for a backend API.
MidJourney Plugin - Another plugin that implements a unique Standalone interaction experience.
Through these examples and templates, you will be able to quickly get started and build your own Standalone plugins, providing users with a richer and more personalized interaction experience.

Overview of SperaxOS Plugin Server
The SperaxOS plugin server is an essential part of the plugin ecosystem, carrying the core logic for interacting with the SperaxOS main body. The main responsibilities of the server include handling requests, executing business logic, authentication verification, and communicating with the plugin gateway. Below is a high-level overview of what the plugin server should include.

Key Components and Functions
Request Handling and Business Logic
Request Reception: Capable of receiving HTTP requests from SperaxOS or the plugin gateway.
Logic Execution: Executes specific business logic, such as data processing and external service calls.
Response Return: Returns structured response data based on the execution result of the business logic.
Plugin Gateway Interaction
Gateway Communication: Effectively communicates with the plugin gateway to ensure correct request routing and timely response transmission.
Local and Remote Compatibility: Supports gateway configuration and interaction in both local development and remote deployment environments.
Server Deployment and Scalability
Cloud Platform Deployment: Supports deployment on cloud platforms (such as Vercel) to leverage the performance and scalability of cloud services.
Environment Configuration: Provides flexible environment configuration options to adapt to different deployment needs.
Compatibility and Cross-Language Support
Multi-Language Support: The server is not limited to a specific programming language and supports implementations in various languages such as JavaScript, Python, and others.
Developer Tools: Provides SDKs and tools to help developers quickly build and test plugin servers.
OpenAPI Schema Integration (Optional)
Interface Definition: Precisely defines the plugin's API interface using OpenAPI Schema, including paths, methods, parameters, and response formats.
Documentation: Provides clear API documentation, enabling SperaxOS to automatically recognize and seamlessly integrate with the plugin server.
Authentication and Security (Optional)
Authentication Mechanism: Implements a secure authentication mechanism to ensure that only authorized requests can access server resources.
Key Management: Provides key or token management, allowing users to securely pass and verify authentication information.

SperaxOS Plugin Gateway
When developing SperaxOS plugins, an indispensable component is the Plugin Gateway. This backend service provides a secure and efficient intermediary layer for communication between the plugins and the SperaxOS core. It not only handles requests from the core, but also forwards these requests to the respective plugin server, and then returns the results of the plugin processing to the SperaxOS core.

Functions of the Plugin Gateway
The core functions of the Plugin Gateway are:

Request Forwarding: It receives plugin invocation requests from the SperaxOS core and routes these requests to the designated plugin server for execution.
Response Aggregation: After the plugin processing is completed, the gateway is responsible for aggregating the results and returning them to the SperaxOS core, completing a full communication cycle.
Security Isolation: The gateway provides a layer of secure isolation between the core and the plugin server, ensuring the security of data transmission and the independence of the plugin execution environment.
Performance Optimization: Deployed as an Edge Function, the gateway ensures low latency and high performance in processing requests.
Configuring and Using the Plugin Gateway in Local Development
When developing SperaxOS plugins locally, correctly configuring and using the Plugin Gateway is crucial for enabling communication between the plugins and SperaxOS. This section will guide you on how to set up the Plugin Gateway in the local development environment and create corresponding gateway routes to handle requests.

Configuring the Local Plugin Gateway Address
In the local development environment, you need to specify the address of the local Plugin Gateway in the manifest.json file of the plugin. This allows SperaxOS to directly send requests to your local service for local debugging.

Open the manifest.json file in your plugin project and add or update the gateway field, setting it to the address of your local gateway. For example, if your local gateway is running on port 3400, you can configure it as follows:

json
{
  "gateway": "http://localhost:3400/api/gateway"
}
In this way, when SperaxOS attempts to communicate with the plugin, it will directly request the configured local gateway address to resolve cross-origin issues in network requests.

Creating Local Gateway Routes
Next, you need to create a gateway route in the local service to handle requests from SperaxOS. You can use the functions provided by the @sperax/chat-plugins-gateway package to quickly create this route.

First, ensure that you have installed the @sperax/chat-plugins-gateway package. If not, you can install it using the following command:

sh
pnpm install @sperax/chat-plugins-gateway
Then, in your local Next.js project, create a new TypeScript file in the api directory, for example, pages/api/gateway.ts, and add the following code:

ts
import { createSperaxOSPluginGateway } from '@sperax/chat-plugins-gateway';

export default createSperaxOSPluginGateway();
This code will create a gateway route to handle SperaxOS requests. The createSperaxOSPluginGateway function will automatically handle tasks such as request forwarding, response aggregation, and security validation.

If you are not using Next.js but instead using Vercel API service, you can create a NodeJS serverless API in the api directory:

ts
import { createGatewayOnNodeRuntime } from '@sperax/chat-plugins-gateway';

export default createGatewayOnNodeRuntime();
Starting the Local Service
Finally, start your local service, ensuring that it listens on the port configured in your manifest.json. For example, if your gateway address is http://localhost:3400/api/gateway, your service should run on port 3400.

Now, when you run SperaxOS plugins in the local development environment, SperaxOS will communicate with your plugin through the local gateway address you configured. This allows you to test and debug the functionality of the plugin in the local environment.

Using the Plugin Gateway with Backend in Other Languages
To support the development of plugin gateways implemented in languages other than JavaScript, we will provide a universal plugin gateway CLI in the SDK. By executing a command, you can quickly start a plugin gateway service. This issue will be tracked in #38.

Configuring and Using OpenAPI Schema
SperaxOS's plugin mechanism provides a powerful and flexible way to extend chat functionality. At the same time, support for the OpenAPI specification makes plugin development more standardized and convenient. This document aims to guide developers on how to configure and use the OpenAPI schema in the SperaxOS server implementation, thereby creating plugins that seamlessly integrate with SperaxOS.

Role of OpenAPI in SperaxOS Plugins
Through the OpenAPI schema, developers can define the API interface of the plugin, including the request path, method, parameters, responses, and more. SperaxOS interprets the OpenAPI document to understand how to interact with the plugin, allowing users to install and use the plugin through SperaxOS's interface without needing to worry about the specific implementation details of the interface.

Step 1: Build Your Service API
Develop your service API and ensure that it can respond to SperaxOS's requests and return appropriate responses. You can use any language and framework of your choice to build this API.

Step 2: Create an OpenAPI Document
Use the OpenAPI specification to describe your service, including defining the API's paths, operations, parameters, responses, and more. You can choose to write your OpenAPI document in YAML or JSON format. Ensure that the document contains all the necessary details so that SperaxOS can interact with your service correctly.

Step 3: Create the SperaxOS Plugin Manifest File
Create a manifest.json file that includes the plugin's metadata and configuration information. Most importantly, provide the URL of your OpenAPI document in the openapi field.

Example of the Plugin Manifest Schema:

json5
{
  openapi: 'https://yourdomain.com/path/to/openapi.json',
  api: [], // No need to configure the api field after setting up openapi

  // ... Other configurations
}
Key Elements of the OpenAPI Specification
When creating an OpenAPI document, ensure that it includes the following:

Basic Information: Such as title, description, version, and more.
Server URL: The URL of the API server.
Endpoints: Available API paths and operations.
Parameters: Input and output parameters for each operation.
Authentication: The authentication methods used by the API.
Responses: Common response messages and error codes.
Integrating with SperaxOS Using OpenAPI
Once your API and OpenAPI document are ready, you can install and test your plugin in the SperaxOS UI. Users will be able to interact with your service through the endpoints defined in your OpenAPI document.

Server Authentication
When developing SperaxOS plugins, server authentication is an important step to ensure the security of the plugin. This document aims to guide developers on how to use different modes for authentication to protect API access from unauthorized use.

Simple Authentication Mode
Simple authentication mode allows developers to specify required authentication fields in the plugin configuration. Through the settings field, you can require users to input specific authentication information, such as an API key.

Example: Search Engine Plugin Authentication
Here is an example of a search engine plugin configuration that requires the user to provide SERPAPI_API_KEY as an authentication field. If the appropriate authentication field is not provided, the plugin will prompt the user to input the necessary information.

json
{
  "settings": {
    "type": "object",
    "required": ["SERPAPI_API_KEY"],
    "properties": {
      "SERPAPI_API_KEY": {
        "title": "SerpAPI API Key",
        "description": "This plugin uses SerpAPI as the search service. For more information, please visit the [SerpAPI website](https://serpapi.com/).",
        "type": "string",
        "minLength": 64,
        "maxLength": 64,
        "format": "password"
      }
    }
  }
}
In the above configuration, the user will need to input an API key with a length of 64 characters. This key will be used on the server to verify if the request is authorized to access the SerpAPI service.

OpenAPI Authentication
For APIs described using the OpenAPI specification, developers can define multiple authentication schemes in the OpenAPI Schema. These schemes may include basic authentication, API keys, OAuth2, and more.

Currently, our OpenAPI authentication implementation may not be perfect. If you encounter any issues during usage or have specific requirements, please feel free to submit an issue to us. We plan to further improve the authentication mechanism in subsequent versions of the plugin to meet more security needs.

Authentication Schemes
apiKey: Authentication using an API key.
http: Using standard HTTP authentication (e.g., Basic Auth).
oauth2: Utilizing the OAuth 2.0 protocol for authentication.
Submitting Issues
If you encounter any problems during authentication implementation or wish for us to support more authentication methods, please contact us through the following channels:

Create a new issue on GitHub
Join our Discord community and provide feedback in the community channel.
We will actively respond to your feedback and consider your requirements in subsequent versions of the plugin.

JavaScript Server
When developing SperaxOS plugins, you may need a server to handle requests and send responses. This document will guide you through developing plugins on the server using JavaScript and recommend using the Vercel platform for deployment.

Vercel as a Server Platform
Vercel is a cloud platform that provides simple deployment and hosting services, suitable for static websites and server-side applications. For SperaxOS plugin development, the following features of Vercel are very useful:

Simple deployment process: You can deploy your code to the cloud in a few simple steps.
Custom domain support: Vercel allows you to associate your service with a custom domain.
Automatic scaling: Resources are automatically scaled based on traffic to ensure service availability.
Edge Runtime Example
Edge Runtime is an execution environment provided by Vercel, allowing your code to run on a global edge network, reducing latency and improving response speed.

Here is an example of a plugin server using Edge Runtime:

ts
import { PluginErrorType, createErrorResponse } from '@sperax/plugin-sdk';

import { manClothes, womanClothes } from '@/data';
import { RequestData, ResponseData } from '@/type';

export const config = {
  runtime: 'edge',
};

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return createErrorResponse(PluginErrorType.MethodNotAllowed);
  }

  const { gender, mood } = (await req.json()) as RequestData;

  const clothes = gender === 'man' ? manClothes : womanClothes;

  const result: ResponseData = {
    clothes: mood ? clothes[mood] : Object.values(clothes).flat(),
    mood,
    today: Date.now(),
  };

  return new Response(JSON.stringify(result));
};
In this example, the server receives a POST request and returns the corresponding clothing recommendation data based on the request content.

Node Runtime Example
If you are more familiar with the Node.js environment, Vercel also supports Node Runtime. Here is an example of a server using Node Runtime:

ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

import fetchContent from './_utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  const result = await fetchContent(data);

  res.status(200).send(result);
}
In this example, the server handles POST requests and processes the request content using a utility function fetchContent, then returns the processed result.

Whether you choose Edge Runtime or Node Runtime, Vercel provides a convenient deployment and runtime environment for SperaxOS plugin server development. You can choose the appropriate execution environment based on your needs and familiar technology stack, and leverage the advantages of Vercel to enhance user experience.

Python Server
This document aims to provide guidance for developers interested in using Python to develop SperaxOS plugin servers. Currently, we do not have an official Python server template, but we recognize this as an important need and are actively working on it.

Exploring Python Server Implementation
While there is no official template at the moment, we encourage developers with Python experience to explore server implementation on their own. In the Python ecosystem, there are many excellent web frameworks that can help you quickly build a server, such as Flask, FastAPI, and Django. These frameworks provide powerful tools and flexible designs to help you build efficient and stable server applications.

We are Actively Working on It
We understand that Python server examples are a crucial resource for the developer community. Therefore, we are working hard to create a Python server example that is easy to understand and use, and we will share it with the community as soon as possible. This example will demonstrate how to receive and process requests from SperaxOS plugins using Python, and send responses.

Contribute Your Template
If you have successfully built a usable Python plugin and are willing to share your experience and achievements with the community, we warmly welcome your contribution. Your template can help other developers get started with Python server development more quickly and make valuable contributions to the SperaxOS plugin ecosystem.

Please contact us and submit your template in the following ways:

Host your project as a GitHub repository and ensure it has a clear README file to guide other developers on how to use it.
Send us the repository link, and we will review and consider including it in our official documentation.
We look forward to your innovation and contribution, and hope to work together to advance SperaxOS plugin development.

Overview of SperaxOS Frontend Plugin Development
SperaxOS frontend plugin development allows developers to build and implement the user interface (UI) and interaction logic of plugins on the SperaxOS platform. This document will provide a high-level overview to help developers understand how to develop the frontend part of SperaxOS plugins and introduce the key steps required to interact with the SperaxOS platform.

Plugin Types and Frontend Requirements
Before starting development, it is important to understand the frontend development requirements for different plugin types:

Markdown Plugin: No frontend development is needed as they directly return content in Markdown format to be displayed in the chat.
Default Plugin: Frontend UI is optional, and if needed, a simple UI display can be built.
Standalone Plugin: Frontend development is mandatory as they require providing a rich interactive experience.
Using Chat Plugin SDK
SperaxOS provides the Chat Plugin SDK, which is a set of tools and components to help developers build plugins. For plugin types that require frontend (such as default and standalone), you need to install the SDK in your project and use it to build the frontend part of the plugin.

fish
pnpm i @sperax/plugin-sdk
or

fish
bun i @sperax/plugin-sdk
Developing Frontend UI and Logic
Depending on your plugin type, you may need to develop the user interface and interaction logic. For standalone plugins, implementing the complete application logic and communication mechanism with SperaxOS is crucial.

Configuring the Manifest File
To integrate with the SperaxOS platform, each plugin needs to have a configuration manifest (manifest.json). For plugins that require frontend, you need to configure the ui field in the manifest.json. The following is the basic configuration for the ui field:

json
"ui": {
  "height": 500,
  "mode": "iframe",
  "url": "http://example.com/iframe",
  "width": 800
}
The ui field specifies the loading method, size, and source address of the plugin UI. The mode here is usually set to iframe, meaning your UI will be loaded as an embedded frame in SperaxOS. For the complete manifest.json configuration and its explanation, please refer to the Plugin Manifest Documentation.

Embedding UI in an Iframe
The UI of SperaxOS plugins is essentially embedded in an iframe, which means the plugins support all types of frontend technology stacks. Whether you choose React, Vue, Angular, or other frameworks, they can be used to build your plugin UI.

Support for React Technology Stack
SperaxOS provides templates and component libraries @sperax/ui specifically designed for the React technology stack, enabling developers to quickly get started and build plugin UI.

sh
npm install @sperax/ui
or

sh
yarn add @sperax/ui
Key Considerations
It is recommended to follow the following steps and considerations to build an extension plugin that provides an excellent experience for users:

Understand the frontend requirements of different plugin types.
Use the SDK and component library provided by SperaxOS to simplify frontend development.
Configure the ui field in the manifest.json to ensure the plugin interface loads correctly.
Consider the complexity of user interaction and the responsiveness of the plugin.

SperaxOS Client SDK
The SperaxOS Client SDK is a frontend development toolkit provided to plugin developers, allowing plugins to communicate efficiently and securely with the SperaxOS application. Through this SDK, developers can easily access data passed to the plugin by SperaxOS, send messages, update plugin status, and manage plugin configuration information.

The core functionality of the SDK is to encapsulate all the underlying communication logic required to interact with SperaxOS, including using the browser's postMessage and addEventListener methods for cross-window communication. This means that developers do not need to delve into complex communication protocols and can focus on implementing plugin functionality.

Usage Example
Obtaining Plugin Initialization Information
When the plugin is loaded, developers may need to obtain the initialization parameters and configuration passed by SperaxOS. Using the SperaxOS Client SDK, this can be easily accomplished with the following lines of code:

javascript
import { speraxOS } from '@sperax/plugin-sdk/client';

// Obtain initialization information
speraxOS.getPluginPayload().then((payload) => {
  console.log('Plugin Name:', payload.name);
  console.log('Plugin Arguments:', payload.arguments);
  console.log('Plugin Settings:', payload.settings);
});
Updating Plugin Message Content
If the plugin needs to send messages during interaction with the user, it can use the methods provided by the SDK to update the message content:

javascript
import { speraxOS } from '@sperax/plugin-sdk/client';

// Send message content
speraxOS.setPluginMessage('Welcome to using our plugin!');
The SperaxOS Client SDK is a powerful assistant for plugin developers, providing a complete, concise, and powerful set of tools to implement various interactive features of SperaxOS plugins. With these tools, developers can focus more on innovation and enhancing user experience without worrying about the implementation details of communication mechanisms.

API
For the complete usage API of the SperaxOS Client SDK, please refer to: SperaxOS Client SDK API Documentation.

Plugin Manifest Schema
Schema for the plugin manifest file
import { pluginManifestSchema } from '@sperax/plugin-sdk';
NPM
UNPKG
BundlePhobia
PackagePhobia
Anvaka Graph
PluginManifestSchema
Description: Defines the data schema for the plugin manifest file.

Usage Example
typescript
import { pluginManifestSchema } from '@sperax/plugin-sdk';

const manifestData = {
  api: [
    {
      description: 'API Description',
      name: 'API Name',
      parameters: {
        properties: {},
        type: 'object',
      },
      url: 'http://example.com/api',
    },
  ],
  gateway: 'http://example.com/gateway',
  identifier: 'plugin-identifier',
  openapi: 'http://example.com/openapi',
  settings: {
    properties: {},
    type: 'object',
  },
  ui: {
    height: 500,
    mode: 'iframe',
    url: 'http://example.com/plugin',
    width: 800,
  },
};

const result = pluginManifestSchema.parse(manifestData);

console.log(result);

// Output: { api: [ { description: 'API Description', name: 'API Name', parameters: { properties: {}, type: 'object' }, url: 'http://example.com/api' } ], gateway: 'http://example.com/gateway', identifier: 'plugin-identifier', openapi: 'http://example.com/openapi', settings: { properties: {}, type: 'object' }, ui: { height: 500, mode: 'iframe', url: 'http://example.com/plugin', width: 800 } }
pluginApiSchema
Description: Defines the data schema for the plugin API.

typescript
import { z } from 'zod';

const JSONSchema = z.object({
  properties: z.object({}),
  type: z.enum(['object']),
});

const pluginApiSchema = z.object({
  description: z.string(),
  name: z.string(),
  parameters: JSONSchema,
  url: z.string().url(),
});

export default pluginApiSchema;
Usage Example
typescript
import { pluginApiSchema } from '@sperax/plugin-sdk';

const apiData = {
  description: 'API Description',
  name: 'API Name',
  parameters: {
    properties: {},
    type: 'object',
  },
  url: 'http://example.com/api',
};

const result = pluginApiSchema.parse(apiData);
console.log(result);
// Output: { description: 'API Description', name: 'API Name', parameters: { properties: {}, type: 'object' }, url: 'http://example.com/api' }
Schema Definitions
pluginManifestSchema
Property  Type  Description
api pluginApiSchema[] List of APIs for the plugin
gateway string (optional) URL of the plugin's gateway
identifier  string  Identifier of the plugin
openapi string (optional) URL of the plugin's OpenAPI documentation
settings  JSONSchema (optional) Definition of the plugin's settings data
ui  object (optional) Configuration for the plugin's UI
ui.height number (optional) Height of the plugin's UI
ui.mode 'iframe' (optional) Mode of the plugin's UI
ui.url  string  URL of the plugin's UI
ui.width  number (optional) Width of the plugin's UI
pluginApiSchema
Property  Type  Description
description string  Description of the plugin API
name  string  Name of the plugin API
parameters  JSONSchema  Definition of the plugin API's parameters
url string  URL of the plugin API


pluginMetaSchema
Schema for plugin meta data
import { pluginMetaSchema } from '@sperax/plugin-sdk';
NPM
UNPKG
BundlePhobia
PackagePhobia
Anvaka Graph
Schema for plugin metadata.

Usage Example
typescript
import { pluginMetaSchema } from '@sperax/plugin-sdk';

const meta = {
  author: 'John Doe',
  createAt: '2022-01-01',
  homepage: 'http://example.com',
  identifier: 'plugin-identifier',
  manifest: 'http://example.com/manifest',
  meta: {
    avatar: 'http://example.com/avatar.png',
    tags: ['tag1', 'tag2'],
  },
  schemaVersion: 1,
};

const result = pluginMetaSchema.parse(meta);

console.log(result);

// 输出：{ author: 'John Doe', createAt: '2022-01-01', homepage: 'http://example.com', identifier: 'plugin-identifier', manifest: 'http://example.com/manifest', meta: { avatar: 'http://example.com/avatar.png', tags: ['tag1', 'tag2'] }, schemaVersion: 1 }
Schema Definition
Property  Type  Description
author  string  Author of the plugin
createAt  string  Creation date of the plugin
homepage  string  Homepage URL of the plugin
identifier  string  Identifier of the plugin
manifest  string  URL of the plugin's description file
meta  object(optional)  Metadata of the plugin
meta.avatar string(optional)  URL of the plugin author's avatar
meta.tags string[](optional)  List of tags for the plugin
schemaVersion number  Version number of the data schema for plugin metadata

getPluginSettingsFromRequest
get plugin settings from request
import { getPluginSettingsFromRequest } from '@sperax/plugin-sdk';
NPM
UNPKG
BundlePhobia
PackagePhobia
Anvaka Graph
Used to retrieve the plugin settings string from the request.

Syntax
ts
const settings = getPluginSettingsFromRequest<T>(req: Request): T | undefined;
Parameters
Parameter Name  Type  Description
req Request Standard request object
Return Value
The return value is T | undefined, which represents the plugin settings string.

Example
ts
import {
  createHeadersWithPluginSettings,
  getPluginSettingsFromRequest,
} from '@sperax/plugin-sdk';

const req = new Request('https://api.example.com', {
  headers: createHeadersWithPluginSettings({ theme: 'dark' }),
});

const settings = getPluginSettingsFromRequest(req);

console.log(settings); // Output: { theme: "dark" }
Notes
Please ensure that the incoming request object contains the `X-Sperax-Plugin-Settings` header field.

If the parsing of the plugin settings string fails, it returns undefined.

Plugin Error Type
Plugin error types
import { PluginErrorType } from '@sperax/plugin-sdk';
NPM
UNPKG
BundlePhobia
PackagePhobia
Anvaka Graph
SperaxOS includes all error types in plugin service requests, including semantic errors, client errors, and server errors.

Usage
Combined with createErrorResponse :

ts
import { PluginErrorType } from '@sperax/plugin-sdk';

export default async (req: Request) => {
  if (req.method !== 'POST') return createErrorResponse(PluginErrorType.MethodNotAllowed);

  // ...
};
Error Type Details
Business Error
Error Type  Description
PluginMarketIndexNotFound Plugin market index parse failed
PluginMarketIndexInvalid  Invalid plugin market index
PluginMetaNotFound  No plugin metadata found
PluginMetaInvalid Invalid plugin metadata
PluginManifestNotFound  Plugin description file does not exist
PluginManifestInvalid Incorrect plugin description file format
PluginSettingsInvalid Incorrect plugin settings
PluginApiNotFound Plugin API does not exist
PluginApiParamsError  Issue with plugin API request parameters
PluginServerError Server error in plugin
Client Error
Error Type  Description
BadRequest  400 Bad Request
Unauthorized  401 Unauthorized
Forbidden 403 Forbidden
ContentNotFound 404 Not Found
MethodNotAllowed  405 Method Not Allowed
TooManyRequests 429 Too Many Requests
Server Error
Error Type  Description
InternalServerError 500 Internal Server Error
BadGateway  502 Bad Gateway
ServiceUnavailable  503 Service Unavailable
GatewayTimeout  504 Gateway Timeout


speraxOS
SperaxOS Client SDK
import { speraxOS } from '@sperax/plugin-sdk/client';
NPM
UNPKG
BundlePhobia
PackagePhobia
Anvaka Graph
This example contains all the key methods for the interaction between the plugin and SperaxOS.

All the methods in this example use the browser's postMessage and addEventListener methods, so they need to be used in a browser environment;
All methods of this function send messages to the parent window through postMessageso the plugin must be embedded in SperaxOS to return the correct message;
getPluginPayload
Get the Function Call information to initialize the plugin.

ts
interface PluginPayload<T = any> {
  arguments?: T;
  name: string;
}

type GetPluginPayload = <T = any>() => Promise<PluginPayload<T>>;
Output parameters
name: the api name of the Function Call
arguments: the parameter object of the Function Call
state: if exist the plugin message have state, you can get it from thi
settings: the plugin settings
Example
ts
import { speraxOS } from '@sperax/plugin-sdk/client';

speraxOS.getPluginPayload().then((payload) => {
  console.log(payload);
});

// payload:
// {
//   name: 'showMJ',
//   arguments: {
//     rawInput: '一只小黄鸭摄影师，在湖边度假，在冬天的下雪天。湖面结冰了',
//   },
// };
getPluginMessage
Used to retrieve the content of the plugin message (content field).

SperaxOS serializes the message object returned by the plugin and stores it in the content field.This method retrieves the content of this field and deserializes it into a JSON object.

ts
type GetPluginMessage = <T = object>() => Promise<T>;
Example
ts
import { speraxOS } from '@sperax/plugin-sdk/client';

speraxOS.getPluginMessage().then((message) => {
  console.log(message);
});
setPluginMessage
This method is used to send messages to SperaxOS to update the content of the plugin message. The content will be serialized, sent to SperaxOS, and the conversation flow will continue.

ts
type SetPluginMessage = <T = object>(content: T) => Promise<void>;
Parameter
content: the plugin content to be filled in.
Example
ts
import { speraxOS } from '@sperax/plugin-sdk/client';

speraxOS.setPluginMessage({ title: 'Hello', message: 'Welcome to my plugin' });
getPluginState
Used to retrieve the runtime state stored in the message.

ts
type GetPluginState = <T = any>(key: string) => Promise<T>;
Input parameter
key: the key value of the state information to be retrieved.
Example
ts
import { speraxOS } from '@sperax/plugin-sdk/client';

speraxOS.getPluginState('counter').then((state) => {
  console.log(state);
});
setPluginState
This method is used to update the specified state information of the plugin.

ts
type SetPluginState = (key: string, value: any) => Promise<void>;
Parameter
key: the key value of the state information to be updated.
value: the value of the state information to be updated.
Example
ts
import { speraxOS } from '@sperax/plugin-sdk/client';

speraxOS.setPluginState('counter', 5);
getPluginSettings
Used to retrieve the configuration information stored by the plugin in SperaxOS.

ts
type GetPluginSettings = <T = any>() => Promise<T>;
Example
ts
import { speraxOS } from '@sperax/plugin-sdk/client';

speraxOS.getPluginSettings().then((state) => {
  console.log(state);
});
setPluginSettings
This method is used to update the configuration information of the plugin.

ts
type SetPluginSettings<T> = (settings: Partial<T>) => Promise<void>;
Input parameter
settings: the plugin configuration information to be updated, default is partial update.
Example
ts
import { speraxOS } from '@sperax/plugin-sdk/client';

speraxOS.setPluginSettings({ theme: 'dark', fontSize: 12 });

useWatchPluginMessage
used to listen for plugin messages sent from SperaxOS
import { useWatchPluginMessage } from '@sperax/plugin-sdk/client';
NPM
UNPKG
BundlePhobia
PackagePhobia
Anvaka Graph
useWatchPluginMessageThis is a React Hook encapsulating the Chat Plugin SDK, used to listen for plugin messages sent from SperaxOS.

Syntax
ts
const { data, loading } = useWatchPluginMessage<T>();
Examples
tsx
import { useWatchPluginMessage } from '@sperax/plugin-sdk/client';

const Demo = () => {
  const { data, loading } = useWatchPluginMessage();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>插件发送的消息数据：</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};

export default Demo;
Notes
Please ensure that useWatchPluginMessage is used within a React functional component.
Return Value Type Definition
Property  Type  Description
data  T Data of the message sent by the plugin
loading boolean Indicates whether the data is currently being loaded

useOnStandalonePluginInit
listen for the initialization of standalone type
import { useOnStandalonePluginInit } from '@sperax/plugin-sdk/client';
NPM
UNPKG
BundlePhobia
PackagePhobia
Anvaka Graph
Used to listen for the initialization of standalone type plugins.
Syntax

Parameters
ts
useOnStandalonePluginInit<T>(callback: (payload: PluginPayload<T>) => void): void;
Parameters
Type  Description A callback function that will be invoked when the plugin initialization event is triggered, and the payload of the plugin initialization event will be passed as a parameter to the callback function.
callback  (payload: PluginPayload<T>) => void Example
Notes
tsx
import { useOnStandalonePluginInit } from '@sperax/plugin-sdk/client';

const Demo = () => {
  useOnStandalonePluginInit((payload) => {
    console.log('插件初始化事件触发');
    console.log('payload:', payload);
  });

  return <div>监听插件初始化事件</div>;
};

export default Demo;
Please ensure that it is used within a React functional component.
Will only be executed once when the component is mounted.useOnStandalonePluginInitIn the callback function, you can process the payload of the plugin initialization event, such as obtaining initialization parameters, calling initialization functions, etc.
useOnStandalonePluginInitCallback function parameter type definition
Property
Type
ts
interface PluginPayload<T = any> {
  args?: T;
  func: string;
}
Description Plugin initialization event parameters  Plugin initialization event function name
arguments T 插件初始化事件的参数
name  string  插件初始化事件的函数名称

usePluginState
Used to retrieve and update the running state of the plugin
import { usePluginState } from '@sperax/plugin-sdk/client';
NPM
UNPKG
BundlePhobia
PackagePhobia
Anvaka Graph
Used to retrieve and update the running state of the plugin.

Syntax
ts
const [value, updateValue] = usePluginState<T>(key, initialValue);
Parameters
Parameter Type  Description
key string  Unique identifier for the state
initialValue  T Initial value of the state
Return value
Properties  Type  Description
value T Current value of the state
updateValue (value: T) => void  Function to update the state
Example
tsx
import { usePluginState } from '@sperax/plugin-sdk/client';

const Demo = () => {
  const [count, setCount] = usePluginState('count', 0);

  const increment = () => {
    setCount(count + 1);
  };

  return (
    <div>
      <h1>当前计数值：{count}</h1>
      <button onClick={increment}>增加</button>
    </div>
  );
};

export default Demo;
Notes
Make sure to use within a React function component.usePluginStateThe parameter must be of type string and is used to uniquely identify the plugin state.
keyThe parameter is the initial value of the state.
initialValueRepresents the current state value, obtained through destructuring assignment.
valueIs the function to update the state value, which accepts a new value as a parameter.
updateValueUsage Example
In the example above, we use 'usePluginState' to manage the state of a counter. The initial value is 0, and each click of the button increases the counter value by 1.
Related LinksusePluginStateReact Hook Documentation

相关链接
React Hook 文档

usePluginSettings
用于管理插件 Settings
import { usePluginSettings } from '@sperax/plugin-sdk/client';
NPM
UNPKG
BundlePhobia
PackagePhobia
Anvaka Graph
Used to retrieve and update plugin settings.

Syntax
ts
const [value, updateValue] = usePluginSettings<T>(initialValue);
Parameters
Parameter Type  Description
initialValue  T Initial value of plugin settings
Return Value
usePluginSettingsReturns an array containing two elements, which are the current plugin settings value and the function to update plugin settings.value 和更新插件设置的函数 updateValue。

Example
tsx
import { usePluginSettings } from '@sperax/plugin-sdk/client';

const Demo = () => {
  const [value, updateValue] = usePluginSettings('default value');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateValue(e.target.value);
  };

  return (
    <div>
      <h1>插件设置：</h1>
      <input type="text" value={value} onChange={handleChange} />
    </div>
  );
};

export default Demo;
Notes
Please ensure to use usePluginSettings inside a React function component.
Initial value initialValuecan be of any type of value.
When updating plugin settings, the postToUpdatePluginSettings method will automatically send update messages to SperaxOS.

PluginChannel Communication Messages
You may not need to use PluginChannel , but if you want to use the underlying message communication mechanism of SperaxOS, you may need to understand these message types. This document contains detailed explanations of communication message types.

Initialization
pluginReadyForRender
Literal:speraxos:plugin-ready-for-render
Used to notify the SperaxOS host that the plugin is ready for rendering

ts
import { PluginChannel } from '@sperax/plugin-sdk';

const channel = PluginChannel.pluginReadyForRender;
INFO
The main program will send information about the plugin through the renderPlugin channel after receiving this message

initStandalonePlugin
Literal:speraxos:init-standalone-plugin
For plugins of type standalone, notifies SperaxOS that the plugin has been initialized

ts
import { PluginChannel } from '@sperax/plugin-sdk';

const channel = PluginChannel.initStandalonePlugin;
Message Content Related
fetchPluginMessage
Literal:speraxos:fetch-plugin-messag
Used for the plugin to initiate a message request to SperaxOS

ts
import { PluginChannel } from '@sperax/plugin-sdk';

const channel = PluginChannel.fetchPluginMessage;
renderPlugin
Literal:speraxos:render-plugin
Used for the main program to send rendering instructions to the plugin.

ts
import { PluginChannel } from '@sperax/plugin-sdk';

const channel = PluginChannel.pluginReadyForRender;
fillStandalonePluginContent
Literal:speraxos:fill-plugin-content
Used to send plugin content to SperaxOS when the plugin is running independently

ts
import { PluginChannel } from '@sperax/plugin-sdk';

const channel = PluginChannel.fillStandalonePluginContent;
Plugin Runtime Related
fetchPluginState
Literal:speraxos:fetch-plugin-state
Used for the plugin to actively request plugin state information from SperaxOS

ts
import { PluginChannel } from '@sperax/plugin-sdk';

const channel = PluginChannel.fetchPluginState;
renderPluginState
Literal:speraxos:render-plugin-state
Used for the main program to render plugin state to the plugin

ts
import { PluginChannel } from '@sperax/plugin-sdk';

const channel = PluginChannel.renderPluginState;
updatePluginState
Literal:speraxos:update-plugin-state
Used for the plugin to send updated plugin state to SperaxOS

ts
import { PluginChannel } from '@sperax/plugin-sdk';

const channel = PluginChannel.updatePluginState;
Settings Related
fetchPluginSettings
Literal:speraxos:fetch-plugin-settings
Used for the plugin to actively request plugin settings information from SperaxOS

ts
import { PluginChannel } from '@sperax/plugin-sdk';

const channel = PluginChannel.fetchPluginSettings;
renderPluginSettings
Literal:speraxos:render-plugin-settings
Used for the main program to render plugin settings to the plugin

ts
import { PluginChannel } from '@sperax/plugin-sdk';

const channel = PluginChannel.renderPluginSettings;
updatePluginSettings
Literal:speraxos:update-plugin-settings
Used for the plugin to send updated plugin settings to SperaxOS

ts
import { PluginChannel } from '@sperax/plugin-sdk';

const channel = PluginChannel.updatePluginSettings;