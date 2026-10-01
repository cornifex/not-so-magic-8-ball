// The 20 classic Magic 8 Ball answers, one per face of the die.
// Shared by the browser (die faces) and the Worker (Jev criteria).
// `lines` are hand-broken so each answer fits inside its triangle: the apex
// is narrow, so earlier lines are kept shorter.
// `meaning` is what Jev reads when ranking answers. Within a group, meanings
// differ by strength so the wording matches how sure Jev is.

export const ANSWERS = [
  { id: "it_is_certain", group: "yes", text: "It is certain.", lines: ["IT IS", "CERTAIN"],
    meaning: "Yes, as a matter of fact: true by definition or beyond any doubt" },
  { id: "reply_hazy_try_again", group: "unsure", text: "Reply hazy, try again.", lines: ["REPLY", "HAZY, TRY", "AGAIN"],
    meaning: "Unclear: the question is vague or muddled" },
  { id: "dont_count_on_it", group: "no", text: "Don't count on it.", lines: ["DON'T", "COUNT", "ON IT"],
    meaning: "Probably not: unlikely to happen or work out" },
  { id: "it_is_decidedly_so", group: "yes", text: "It is decidedly so.", lines: ["IT IS", "DECIDEDLY", "SO"],
    meaning: "Yes, emphatically: overwhelming consensus or evidence" },
  { id: "without_a_doubt", group: "yes", text: "Without a doubt.", lines: ["WITHOUT", "A DOUBT"],
    meaning: "Yes, and no reasonable person would disagree" },
  { id: "ask_again_later", group: "unsure", text: "Ask again later.", lines: ["ASK", "AGAIN", "LATER"],
    meaning: "Too early to say: depends on things that haven't happened yet" },
  { id: "my_reply_is_no", group: "no", text: "My reply is no.", lines: ["MY", "REPLY IS", "NO"],
    meaning: "No, plainly: a bad idea or simply not the case" },
  { id: "yes_definitely", group: "yes", text: "Yes definitely.", lines: ["YES", "DEFINITELY"],
    meaning: "Yes, clearly the right choice or obviously a good idea" },
  { id: "you_may_rely_on_it", group: "yes", text: "You may rely on it.", lines: ["YOU", "MAY RELY", "ON IT"],
    meaning: "Yes, dependable: safe to count on happening or working out" },
  { id: "better_not_tell_you_now", group: "unsure", text: "Better not tell you now.", lines: ["BETTER", "NOT TELL", "YOU NOW"],
    meaning: "Not the ball's call: a personal or private matter" },
  { id: "my_sources_say_no", group: "no", text: "My sources say no.", lines: ["MY", "SOURCES", "SAY NO"],
    meaning: "No, according to facts or common knowledge" },
  { id: "as_i_see_it_yes", group: "yes", text: "As I see it, yes.", lines: ["AS I", "SEE IT,", "YES"],
    meaning: "Yes, as a judgment call: a matter of opinion that leans yes" },
  { id: "most_likely", group: "yes", text: "Most likely.", lines: ["MOST", "LIKELY"],
    meaning: "Probably yes: likely, but not guaranteed" },
  { id: "cannot_predict_now", group: "unsure", text: "Cannot predict now.", lines: ["CANNOT", "PREDICT", "NOW"],
    meaning: "Unpredictable: pure chance, like a coin flip or a lottery" },
  { id: "outlook_not_so_good", group: "no", text: "Outlook not so good.", lines: ["OUTLOOK", "NOT SO", "GOOD"],
    meaning: "Probably not: the future looks unfavorable" },
  { id: "outlook_good", group: "yes", text: "Outlook good.", lines: ["OUTLOOK", "GOOD"],
    meaning: "Probably yes: the future looks favorable" },
  { id: "yes", group: "yes", text: "Yes.", lines: ["YES"],
    meaning: "Yes, plainly and simply" },
  { id: "concentrate_and_ask_again", group: "unsure", text: "Concentrate and ask again.", lines: ["CONCEN-", "TRATE AND", "ASK AGAIN"],
    meaning: "Not a yes-or-no question, or needs more detail to judge" },
  { id: "very_doubtful", group: "no", text: "Very doubtful.", lines: ["VERY", "DOUBTFUL"],
    meaning: "Almost certainly not: extremely unlikely or false" },
  { id: "signs_point_to_yes", group: "yes", text: "Signs point to yes.", lines: ["SIGNS", "POINT", "TO YES"],
    meaning: "Leaning yes: the available clues point that way" },
];
