/**
 * The `welcome` transactional React-Email template — THE template the acceptance test renders +
 * sends (PLAN §5). Rendered to HTML via @react-email/render (PINNED + explicit — PIT-14/SCN-07).
 *
 * Deliberately inline-styled (O-04: never trust <style> blocks / media queries — PIT-16) and with
 * a non-empty <Preview> (PIT-17: a blank Preview blanks the whole email in Gmail). Dogfooded: this
 * passes `pigeon lint` clean.
 */
import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface WelcomeEmailProps {
  /** the recipient's name (transactional personalization). */
  name?: string;
}

/** A warm-black + amber transactional welcome (the pigeon brand tokens). */
export function WelcomeEmail({ name = "there" }: WelcomeEmailProps): React.ReactElement {
  return (
    <Html lang="en">
      <Head />
      <Preview>Welcome — your account is ready and verified.</Preview>
      <Body style={{ backgroundColor: "#141312", margin: "0", padding: "0" }}>
        <Container
          style={{
            maxWidth: "560px",
            margin: "0 auto",
            padding: "32px 24px",
            backgroundColor: "#1c1a18",
          }}
        >
          <Section>
            <Heading
              style={{
                color: "#f5a623",
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "24px",
                margin: "0 0 16px",
              }}
            >
              Welcome, {name}.
            </Heading>
            <Text
              style={{
                color: "#e8e6e3",
                fontFamily: "Helvetica, Arial, sans-serif",
                fontSize: "16px",
                lineHeight: "24px",
                margin: "0 0 16px",
              }}
            >
              Your account is ready. This is a transactional message — it arrives in the inbox, not
              the spam folder, because the sending domain is authenticated and aligned.
            </Text>
            <Text
              style={{
                color: "#8a8784",
                fontFamily: "Helvetica, Arial, sans-serif",
                fontSize: "13px",
                lineHeight: "20px",
                margin: "24px 0 0",
              }}
            >
              Sent by pigeon — the deliverability-correct sending layer. Powered by Energy.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default WelcomeEmail;
