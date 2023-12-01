const OpenAI = require("openai");

exports.handler = awslambda.streamifyResponse( async (event, responseStream, _context) => {
    // Metadata is a JSON serializable JS object. Its shape is not defined here.
    const metadata = {
            statusCode: 200,
            headers: {
                "Content-Type": "text/html",
                "Access-Control-Allow-Credentials": true
            }};

    // Assign to the responseStream parameter to prevent accidental reuse of the non-wrapped stream.
    responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);
    const functionName = "create_book_recommendation";
    const STRING_TYPE = "string";
    const OBJECT_TYPE = "object"
    const ARRAY_TYPE = "array"
    const functions = [ {
        name: functionName,
        description: "Creates personalized book recommendation",
        parameters: {
            type: OBJECT_TYPE,
            properties: {
                results: {
                    type: ARRAY_TYPE,
                    items: {
                        type: OBJECT_TYPE,
                    properties: {
                        title: {
                            type: STRING_TYPE,
                            description: "Book Title"
                        },
                        author: {
                            type: STRING_TYPE,
                            description: "Book Author"
                        }
                    },
                    required: ["title", 
                    "author", 
                ]
                    }
                }
            }
        }
    }]
    const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY});

    const body = JSON.parse(event.body)
    let lookingFor = body.lookingFor
    if(!lookingFor) {
        //TODO error checking instead
        lookingFor = "I am looking for great books"
    }
    const chatStream = await openai.chat.completions.create({
            model: "gpt-4-1106-preview",
            messages: [
                {role: "system", "content": "You give great book recommendations. Limit to top 5 responses."},
                {role: "user", "content": lookingFor},
            ],
            functions: functions,
            function_call: {name: functionName},
            stream: true
        });

        for await (const chunk of chatStream) {
            const delta = chunk.choices[0]?.delta?.function_call?.arguments
            const finish_reason = chunk.choices[0]?.finish_reason
            if(finish_reason && finish_reason !== 'stop') {
                console.error(`Error: ${finish_reason}`)
                break;
            }
            if(delta) {
                responseStream.write(delta)
            }
        }
    responseStream.end();
});