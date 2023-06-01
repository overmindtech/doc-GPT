import fs from "fs";
import path from "path";
import { Client } from "@notionhq/client";
import { Configuration, CreateCompletionResponse, OpenAIApi } from "openai";
import dotenv from "dotenv";

dotenv.config();
let inputData = "";
const DatabaseId = process.env.LINKS_DATABASE_ID;
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// format input data to match docs-gen output
interface DocData {
  type: string;
  descriptiveType: string;
  group: string;
  links: string[];
}
// ChatGPT parameters, currently uses 3.5GPT, max token set to under 2000 characters as notion limit
const completionParams = {
  model: "text-davinci-003",
  temperature: 0.7,
  max_tokens: 356,
  top_p: 1,
  frequency_penalty: 1,
  presence_penalty: 0,
};

// Creating an instance of OpenAIApi
const openai = new OpenAIApi(
  new Configuration({ apiKey: process.env.OPENAI_KEY })
);

// Sends requests to OpenAI
const getResponses = async (prompts: string[]): Promise<string[]> => {
  const responses: string[] = [];
  for (const prompt of prompts) {
    try {
      const completion = await openai.createCompletion({
        ...completionParams,
        prompt,
      });
      if (completion.data.choices[0].text !== undefined) {
        responses.push(completion.data.choices[0].text.trimStart());
      } else {
        responses.push("Text is undefined");
      }
    } catch (error: any) {
      if (error.response) {
        console.error(error.response.status);
        console.error(error.response.data);
      } else {
        console.error(error.message);
      }
    }
  }
  return responses;
};
// Reads json input files
function readJsonFiles(files: string[]): DocData[] {
  const jsonData: DocData[] = [];

  for (const file of files) {
    const filePath = path.join(file);

    try {
      const fileContent = fs.readFileSync(filePath, "utf8");
      const jsonContent = JSON.parse(fileContent);
      jsonData.push(jsonContent);
    } catch (err) {
      console.error(`Not a valid JSON file: ${filePath}`);
    }
  }
  return jsonData;
}
process.stdin.on("readable", () => {
  const chunk = process.stdin.read();
  if (chunk !== null) {
    inputData += chunk;
  }
});
// takes input and creates prompts and sends them
process.stdin.on("end", async () => {
  const prompts = [
    "What is the link between",
    "Using bullet points where possible. Give me a list and a one sentence description of all keywords commonly used in relation to",
    "What are some common issues between",
  ];
  // used to get tailored answers
  const modelPrompt =
    "You are an expert technical copywriter who can rewrite content in your own voice and style. You have a informative tone of voice. You have a Academic writing style. Please intersperse short and long sentences. Utilize industry terminology to enhance the originality of the content so that it is not clear that it is written by AI. Please format the content in a professional format. Do not self reference. Do not explain what you are doing. Do not try to define what the items are. Assume the reader is a expert in the field of computing.";
  // creates page content and prompts
  const result: DocData = JSON.parse(inputData.trim());
  for (const link of result.links) {
    const combined = result.type + " " + "and" + " " + link;
    const heading = result.type + " " + "->" + " " + link;
    const linked = link;
    const slug = result.type + "&" + link;
    const linksPrompts = prompts.map(
      (prompts) =>
        modelPrompt +
        " " +
        prompts +
        " " +
        combined +
        " in " +
        result.group +
        " ?"
    );
    // checks notion pages first
    checkPage(DatabaseId, heading);
    async function checkPage(databaseId: any, link: string) {
      const response = await notion.databases.query({
        database_id: databaseId,
        filter: {
          property: "Link",
          title: {
            equals: link,
          },
        },
      });
      if (response.results[0] !== undefined) {
        console.log("Page already exists");
      } else {
        //const Responses = await getResponses(linksPrompts);
        createPage(
          DatabaseId,
          result.type,
          result.descriptiveType,
          result.group,
          linked,
          //Responses,
          result.links,
          heading,
          slug,
          combined
        );
      }
      // creates notion pages
      async function createPage(
        databaseId: any,
        type: string,
        descriptiveType: string,
        group: string,
        links: string,
        Responses: string[],
        heading: string,
        slug: string,
        combined: string
      ) {
        await notion.pages.create({
          parent: {
            database_id: databaseId,
          },
          properties: {
            Link: {
              type: "title",
              title: [
                {
                  type: "text",
                  text: {
                    content: heading,
                  },
                },
              ],
            },
            descriptiveType: {
              type: "rich_text",
              rich_text: [
                {
                  type: "text",
                  text: {
                    content: descriptiveType || "",
                  },
                },
              ],
            },
            type: {
              type: "rich_text",
              rich_text: [
                {
                  type: "text",
                  text: {
                    content: type || "",
                  },
                },
              ],
            },
            group: {
              type: "rich_text",
              rich_text: [
                {
                  type: "text",
                  text: {
                    content: group || "",
                  },
                },
              ],
            },
            links: {
              type: "rich_text",
              rich_text: [
                {
                  type: "text",
                  text: {
                    content: linked || "",
                  },
                },
              ],
            },
            Slug: {
              type: "rich_text",
              rich_text: [
                {
                  type: "text",
                  text: {
                    content: slug || "",
                  },
                },
              ],
            },
            Combined: {
              type: "rich_text",
              rich_text: [
                {
                  type: "text",
                  text: {
                    content: combined || "",
                  },
                },
              ],
            },
            Description: {
              type: "rich_text",
              rich_text: [
                {
                  type: "text",
                  text: {
                    content: Responses[0] || "",
                  },
                },
              ],
            },
            Keywords: {
              type: "rich_text",
              rich_text: [
                {
                  type: "text",
                  text: {
                    content: Responses[1] || "",
                  },
                },
              ],
            },
            "Common issues": {
              type: "rich_text",
              rich_text: [
                {
                  type: "text",
                  text: {
                    content: Responses[2] || "",
                  },
                },
              ],
            },
          },
        });
        console.log("Page created successfully");
      }
    }
  }
});
