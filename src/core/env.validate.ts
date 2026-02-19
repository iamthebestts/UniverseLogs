import chalk from "chalk";
import type { ZodObject, ZodRawShape, z } from "zod";

const x = chalk.red("✖");
const w = chalk.yellow("▲");

export function validateEnv<T extends ZodRawShape>(schema: ZodObject<T>) {
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    console.error(`\n${x} Invalid environment variables:\n`);

    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "UNKNOWN";
      console.error(`${x} ${chalk.bold(key)} → ${issue.message}`);

      if (issue.code === "invalid_type") {
        console.error(
          chalk.dim(
            `  Expected ${chalk.green(issue.expected)}, got ${chalk.red(typeof issue.input)}`,
          ),
        );
      }
    }

    console.log();
    console.warn(
      [
        `${w} Environment setup hints:`,
        `- Use scripts with ${chalk.blue("--env-file")}`,
        `- Export vars manually or via Docker / CI`,
        "",
      ].join("\n"),
    );

    process.exit(1);
  }

  console.log(chalk.green(`${chalk.magenta("☰ Environment")} loaded successfully`));

  return parsed.data as z.infer<typeof schema>;
}
