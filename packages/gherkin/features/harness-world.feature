# One feature, run by every Gherkin adapter's test app against the conformance
# fixture: the world's lifetime, the page registry, and an action handing back
# the page it leads to all behave the same under every runner.
Feature: Harnesses in a Gherkin scenario

  Scenario: A page carries across steps through the world
    Given the world is empty
    When I open the wizard page
    Then the wizard shows "Step one"

  Scenario: Nothing leaks from one scenario into the next
    Then the world is empty

  Scenario: An action hands back the page it leads to
    When I open the wizard page
    And I continue from step one
    Then the current step shows "Step two"
