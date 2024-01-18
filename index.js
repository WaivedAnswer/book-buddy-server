const OpenAI = require("openai");

const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY});

async function passesModeration(lookingFor) {
    let input = lookingFor
    const moderation = await openai.moderations.create({ input: input });
    if(moderation.results.length !==0 && moderation.results[0].flagged) {
        console.log("Failed moderation")
        return false
    } 
    return true
}

function getMetaData(statusCode) {
    return {
        statusCode: statusCode,
        headers: {
            "Content-Type": "text/html",
            "Access-Control-Allow-Credentials": true
        }
    }
}

function logError(error) {
    console.error(JSON.stringify({
        error: error.message,
        stackTrace: error.stackTrace
    }))
}

exports.handler = awslambda.streamifyResponse( async (event, responseStream, _context) => {
    const body = JSON.parse(event.body)
    let lookingFor = body.lookingFor

    try {
        const passed = await passesModeration(lookingFor)
        if ( !passed) {
            responseStream.write(getErrorResponse("MODERATION"))
            responseStream.end()
            return
        }
    } catch(error) {
        logError(error)
        responseStream.write(getErrorResponse("OPEN_AI"))
    }
    

    // Metadata is a JSON serializable JS object. Its shape is not defined here.
    const metadata = getMetaData(200);
    // Assign to the responseStream parameter to prevent accidental reuse of the non-wrapped stream.
    responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);
    const functionName = "display_book_recommendation";
    const STRING_TYPE = "string";
    const OBJECT_TYPE = "object"
    const ARRAY_TYPE = "array"
    const functions = [ {
        name: functionName,
        description: "Displays book recommendation",
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

    console.log("Updated 2")
    try {
        console.log("Search:" + lookingFor)
        const chatStream = await openai.chat.completions.create({
            model: "gpt-4-1106-preview",
            messages: [
                {role: "system", "content": "Act as an expert librarian, tailoring book recommendations to user preferences without spoilers. Be forgiving with typos and misunderstandings. Focus on understanding the user's search intent and matching the user's reading tastes. When users request authors similar to a specific writer, suggest comparable authors, excluding the mentioned one. When users request books similar to a specific book, suggest other books with similar elements. For genre-based queries, recommend top books within that genre. Limit to top 5 responses."},
                {role: "user", "content": "The user's search was: " + lookingFor},
            ],
            functions: functions,
            function_call: {name: functionName},
            stream: true
        });

        for await (const chunk of chatStream) {
            const delta = chunk.choices[0]?.delta?.function_call?.arguments
            const finish_reason = chunk.choices[0]?.finish_reason
            if(finish_reason && finish_reason !== 'stop') {
                logError(new Error(`Error: ${finish_reason}`))
                break;
            }
            if(delta) {
                responseStream.write(delta)
            }
        }
    } catch (error) {
        logError(error)
        responseStream.write(getErrorResponse("STREAM_FAILURE"))
    } finally {
        responseStream.end();
    }

});

function getErrorResponse(errorType) {
    return JSON.stringify({
        error: errorType
    });
}
